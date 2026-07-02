/**
 * Job-name → processor routing (#33 worker wiring). Pure composition over
 * the Stage-0/2/8 handlers — every handler already exists and is
 * unit-tested; this layer only assembles their live deps from fastify.
 *
 * verify-tx republish (stage-2 § listener step 5) does both fan-outs:
 *   1. WS: `escrow:<id>` frame `{type:'escrow_event', event, tx_ref}` —
 *      the exact contract TransactionMonitor subscribes to (#42).
 *   2. Push: a 'notifications' job addressed to the party who needs to
 *      LEARN about the event (the non-actor), resolved from the escrow row.
 */

import { and, eq, inArray, or } from 'drizzle-orm'
import type { FastifyInstance } from 'fastify'
import { device_tokens, gig_subscriptions } from '@tenda/shared/db/schema'
import { escrows, gig_details } from '@tenda/shared/db/schema/escrow'
import { channelName } from '@server/lib/ws'
import { drizzleEscrowEventStore } from '@server/lib/escrow-events'
import {
  buildPushServices,
  routePush,
  type DevicePlatform,
  type PlatformToken,
} from '@server/lib/push-services'
import type { PushService } from '@server/chains/types'
import { getConfig } from '@server/config'
import { buildFiatDeps } from '@server/features/fiat-rails'
import { buildOtpSenders } from '@server/lib/onboarding-deps'
import { deliverOtp } from '@server/lib/otp'
import {
  drizzleVerifyTxStore,
  verifyTxJobHandler,
  type VerifyTxDeps,
} from '@server/jobs/verify-tx'
import { drizzleExpireEscrowsStore, handleExpireEscrows } from '@server/jobs/expire-escrows'
import { drizzleReconcileStore, reconcileEscrowsHandler } from '@server/jobs/reconcile-escrows'
import { reconcileFiatIntentsHandler } from '@server/jobs/reconcile-fiat-intents'
import { expireFiatQuotesHandler } from '@server/jobs/expire-fiat-quotes'
import {
  drizzlePriceStatsStore,
  updatePriceStatsHandler,
} from '@server/features/moderation/jobs/update-price-stats'
import type { JobName, JobPayload } from '@server/plugins/queue'
import type { InternalEscrowEvent } from '@server/lib/escrow-events'

// ---------- escrow-event push fan-out ---------------------------------------

interface EventNotice {
  /** Which party learns about it — the one who didn't act. */
  recipient: 'creator' | 'counterparty' | 'both'
  title: string
  body: string
}

/**
 * High-signal events only — lifecycle steps the OTHER party must react
 * to. Expiry notices ride the expire-escrows job; created/cancelled are
 * the actor's own doing.
 */
const NOTICE_BY_EVENT: Partial<Record<InternalEscrowEvent, EventNotice>> = {
  'escrow.accepted': {
    recipient: 'creator',
    title: 'Gig accepted',
    body: 'A worker accepted your gig — work is underway.',
  },
  'escrow.declined': {
    recipient: 'creator',
    title: 'Assignment declined',
    body: 'Your assigned worker declined. The gig is now open to everyone.',
  },
  'escrow.proof_submitted': {
    recipient: 'creator',
    title: 'Work submitted',
    body: 'Proof of completion is in — review and approve to release payment.',
  },
  'escrow.approved': {
    recipient: 'counterparty',
    title: 'Payment released',
    body: 'The poster approved your work. Funds are in your wallet.',
  },
  'escrow.payment_claimed': {
    recipient: 'creator',
    title: 'Payment auto-claimed',
    body: 'The approval window passed, so the worker claimed payment.',
  },
  'escrow.abandoned': {
    recipient: 'counterparty',
    title: 'Escrow reclaimed',
    body: 'The poster reclaimed the escrow after the completion window passed.',
  },
  'escrow.dispute_raised': {
    recipient: 'both',
    title: 'Dispute opened',
    body: 'A dispute was raised on your escrow. Our team will review it.',
  },
  'escrow.dispute_resolved': {
    recipient: 'both',
    title: 'Dispute resolved',
    body: 'Your dispute has been resolved — check the escrow for the outcome.',
  },
}

/**
 * New-gig fan-out: when the on-chain create confirms (escrow → open),
 * notify gig_subscriptions matching the gig's city/category ('*' is the
 * any-value sentinel). Moved here from the legacy notifications plugin —
 * v2 has no publish route; "the gig went live" IS the created event.
 */
async function fanOutNewGigToSubscribers(
  fastify: FastifyInstance,
  escrow_id: string,
): Promise<void> {
  const [gig] = await fastify.db
    .select({
      creator_id: escrows.creator_id,
      title: gig_details.title,
      city: gig_details.city,
      category: gig_details.category,
    })
    .from(escrows)
    .innerJoin(gig_details, eq(gig_details.escrow_id, escrows.id))
    .where(and(eq(escrows.id, escrow_id), eq(escrows.kind, 'gig')))
    .limit(1)
  // Exchange escrows have no gig_details row — nothing to fan out.
  if (gig === undefined) return

  // Remote gigs match wildcard-city subscribers only; local gigs match
  // city + wildcard. Category filtered the same way.
  const subs = await fastify.db
    .select({ user_id: gig_subscriptions.user_id })
    .from(gig_subscriptions)
    .where(
      and(
        gig.city === null
          ? eq(gig_subscriptions.city, '*')
          : or(eq(gig_subscriptions.city, gig.city), eq(gig_subscriptions.city, '*')),
        or(eq(gig_subscriptions.category, gig.category), eq(gig_subscriptions.category, '*')),
      ),
    )

  const subscriberIds = [...new Set(subs.map((s) => s.user_id))].filter(
    (uid) => uid !== gig.creator_id,
  )
  for (const user_id of subscriberIds) {
    await fastify.queue.enqueue('notifications', {
      user_id,
      title: 'New Gig Posted',
      body: `"${gig.title}" in ${gig.city ?? 'Remote'}`,
      data: { screen: 'escrow', escrowId: escrow_id },
    })
  }
}

async function fanOutEscrowEvent(
  fastify: FastifyInstance,
  event: { internal_event: InternalEscrowEvent; escrow_id: string; tx_ref: string; wire_event: string },
): Promise<void> {
  // 1. Live WS frame — matches shared EscrowEventFrame exactly.
  fastify.wsBroadcast.broadcast(channelName({ kind: 'escrow', id: event.escrow_id }), {
    type: 'escrow_event',
    escrow_id: event.escrow_id,
    event: event.wire_event,
    tx_ref: event.tx_ref,
  })

  // 2. New-gig subscriber fan-out (created = went live; the actor needs no
  //    notice, subscribers do).
  if (event.internal_event === 'escrow.created') {
    await fanOutNewGigToSubscribers(fastify, event.escrow_id)
    return
  }

  // 3. Push fan-out for high-signal events.
  const notice = NOTICE_BY_EVENT[event.internal_event]
  if (notice === undefined) return

  const [row] = await fastify.db
    .select({ creator_id: escrows.creator_id, counterparty_id: escrows.counterparty_id })
    .from(escrows)
    .where(eq(escrows.id, event.escrow_id))
    .limit(1)
  if (row === undefined) return

  const recipients =
    notice.recipient === 'both'
      ? [row.creator_id, row.counterparty_id]
      : notice.recipient === 'creator'
        ? [row.creator_id]
        : [row.counterparty_id]

  for (const user_id of recipients) {
    if (user_id === null) continue
    await fastify.queue.enqueue('notifications', {
      user_id,
      title: notice.title,
      body: notice.body,
      data: { screen: 'escrow', escrowId: event.escrow_id },
    })
  }
}

// ---------- notifications delivery ---------------------------------------------

async function deliverNotification(
  fastify: FastifyInstance,
  services: Partial<Record<DevicePlatform, PushService>>,
  payload: JobPayload['notifications'],
): Promise<void> {
  // Tokens resolve at DELIVERY time (queue.ts doc: tokens churn between
  // enqueue and delivery; resolving early pushes to stale devices). The push
  // `services` are built ONCE in buildProcessors and reused — see the note
  // there on why they must not be rebuilt per delivery.
  const rows = await fastify.db
    .select({ token: device_tokens.token, platform: device_tokens.platform })
    .from(device_tokens)
    .where(eq(device_tokens.user_id, payload.user_id))
  if (rows.length === 0) return

  const tokens: PlatformToken[] = rows.map((r) => ({ token: r.token, platform: r.platform }))
  const result = await routePush({ services, log: fastify.log }, tokens, {
    title: payload.title,
    body: payload.body,
    ...(payload.data !== undefined ? { data: payload.data } : {}),
  })
  // Prune tokens the providers reported permanently gone (resolved issue
  // C1 — regressed when fan-out moved off the legacy plugin at #34).
  await removeTokens(fastify, result.invalid_tokens)
}

/** Prune device tokens the providers reported dead. Exported for reuse. */
export async function removeTokens(fastify: FastifyInstance, tokens: string[]): Promise<void> {
  if (tokens.length === 0) return
  await fastify.db.delete(device_tokens).where(inArray(device_tokens.token, tokens))
}

// ---------- deps builders --------------------------------------------------------

export function buildVerifyTxDeps(fastify: FastifyInstance): VerifyTxDeps {
  return {
    store: drizzleVerifyTxStore(fastify.db),
    chains: fastify.chains,
    eventStore: drizzleEscrowEventStore(fastify.db),
    republish: (event) => fanOutEscrowEvent(fastify, event),
    log: fastify.log,
  }
}

// ---------- routing map ------------------------------------------------------------

export type JobProcessor<N extends JobName> = (payload: JobPayload[N]) => Promise<unknown>

export function buildProcessors(
  fastify: FastifyInstance,
  // Built ONCE here (default) for the worker's lifetime. Each service instance
  // holds its provider auth-token cache (FCM OAuth access token / APNS JWT,
  // ~50-min refresh — see lib/push-services). buildProcessors runs once at
  // worker-plugin init, so rebuilding per delivery would discard the cache and
  // re-exchange the token on every single notification. Injectable for tests.
  pushServices: Partial<Record<DevicePlatform, PushService>> = buildPushServices(
    getConfig(),
    fastify.log,
  ),
): { [N in JobName]: JobProcessor<N> } {
  // Built ONCE for the worker's lifetime (stateless fetch clients) — the
  // send-otp processor reuses them across every delivery. Same source the
  // inline (no-Redis) dispatch uses, so the two paths can't drift.
  const otpSenders = buildOtpSenders(fastify)
  return {
    'verify-tx': (payload) => verifyTxJobHandler(buildVerifyTxDeps(fastify), payload),

    'expire-escrows': (payload) =>
      handleExpireEscrows(
        {
          store: drizzleExpireEscrowsStore(fastify.db),
          queue: fastify.queue,
          log: fastify.log,
          now: () => new Date(),
        },
        payload,
      ),

    reconcile: (payload) =>
      reconcileEscrowsHandler(
        {
          store: drizzleReconcileStore(fastify.db),
          chains: fastify.chains,
          queue: fastify.queue,
          log: fastify.log,
          now: () => new Date(),
        },
        payload,
      ),

    'reconcile-fiat': async () => reconcileFiatIntentsHandler(await buildFiatDeps(fastify)),

    'expire-fiat-quotes': async () => expireFiatQuotesHandler(await buildFiatDeps(fastify)),

    'update-price-stats': () =>
      updatePriceStatsHandler({ store: drizzlePriceStatsStore(fastify.db), log: fastify.log }),

    notifications: (payload) => deliverNotification(fastify, pushServices, payload),

    // Decoupled OTP delivery — a throw here propagates so BullMQ retries on the
    // queue's exponential backoff (well within the 10-min code TTL).
    'send-otp': (payload) => deliverOtp(otpSenders, payload),
  }
}
