/**
 * Job-name → processor routing (#33 worker wiring). Pure composition over
 * the Stage-0/2/8 handlers, every handler already exists and is
 * unit-tested; this layer only assembles their live deps from fastify.
 *
 * verify-tx republish (stage-2 § listener step 5) does both fan-outs:
 *   1. WS: `escrow:<id>` frame `{type:'escrow_event', event, tx_ref}`,
 *      the exact contract TransactionMonitor subscribes to (#42).
 *   2. Push: a 'notifications' job addressed to the party who needs to
 *      LEARN about the event (the non-actor), resolved from the escrow row.
 */

import { eq, inArray } from 'drizzle-orm'
import type { FastifyInstance } from 'fastify'
import { device_tokens } from '@tenda/shared/db/schema'
import { drizzleEscrowEventStore } from '@server/lib/escrow-events'
import { fanOutEscrowEvent } from './escrow-fanout'
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

// ---------- notifications delivery ---------------------------------------------

async function deliverNotification(
  fastify: FastifyInstance,
  services: Partial<Record<DevicePlatform, PushService>>,
  payload: JobPayload['notifications'],
): Promise<void> {
  // Tokens resolve at DELIVERY time (queue.ts doc: tokens churn between
  // enqueue and delivery; resolving early pushes to stale devices). The push
  // `services` are built ONCE in buildProcessors and reused, see the note
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
  // C1, regressed when fan-out moved off the legacy plugin at #34).
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
  // ~50-min refresh, see lib/push-services). buildProcessors runs once at
  // worker-plugin init, so rebuilding per delivery would discard the cache and
  // re-exchange the token on every single notification. Injectable for tests.
  pushServices: Partial<Record<DevicePlatform, PushService>> = buildPushServices(
    getConfig(),
    fastify.log,
  ),
): { [N in JobName]: JobProcessor<N> } {
  // Built ONCE for the worker's lifetime (stateless fetch clients), the
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

    // Decoupled OTP delivery, a throw here propagates so BullMQ retries on the
    // queue's exponential backoff (well within the 10-min code TTL).
    'send-otp': (payload) => deliverOtp(otpSenders, payload),
  }
}
