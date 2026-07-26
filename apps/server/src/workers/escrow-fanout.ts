/**
 * Escrow-event push/WS fan-out (extracted from workers/processors.ts to keep
 * it under the file-size budget and to unit-test the copy in isolation).
 *
 * verify-tx republish (stage-2 § listener step 5) calls fanOutEscrowEvent:
 *   1. WS: an `escrow:<id>` frame the TransactionMonitor subscribes to (#42).
 *   2. Push: a 'notifications' job to the party who must LEARN of the event
 *      (the non-actor), resolved from the escrow row.
 *
 * Copy is KIND-AWARE: gigs and P2P exchanges share the same escrow primitive
 * but read very differently to the user ("worker accepted your gig" vs "buyer
 * accepted your offer"), so every notice carries both wordings and the fan-out
 * picks by escrows.kind. The push `data` always carries { kind, escrowId } so
 * the mobile deep-link can route to /gig/:id vs /exchange/:id.
 */

import { and, eq, or } from 'drizzle-orm'
import type { FastifyInstance } from 'fastify'
import { gig_subscriptions } from '@tenda/shared/db/schema'
import { escrows, gig_details } from '@tenda/shared/db/schema/escrow'
import { channelName } from '@server/lib/ws'
import { enqueueNotification, escrowPushData } from '@server/lib/notify'
import type { InternalEscrowEvent } from '@server/lib/escrow-events'
import type { EscrowEvent } from '@server/chains/types'
import type { EscrowKind } from '@tenda/shared'

/** The republish event shape (mirrors VerifyTxDeps.republish in verify-tx). */
export interface EscrowFanoutEvent {
  internal_event: InternalEscrowEvent
  escrow_id: string
  wire_event: EscrowEvent
  tx_ref: string
  /** See VerifyTxDeps.republish — the released worker's only address. */
  counterparty_id: string | null
}

interface NoticeCopy {
  title: string
  body: string
}

interface EventNotice {
  /** Which party learns about it — the one who didn't act. */
  recipient: 'creator' | 'counterparty' | 'both'
  gig: NoticeCopy
  exchange: NoticeCopy
}

/**
 * High-signal events only: lifecycle steps the OTHER party must react to.
 * Expiry notices ride the expire-escrows job; created/cancelled are the
 * actor's own doing. Exchange copy frames the same transition from the P2P
 * seller/buyer perspective.
 */
const NOTICE_BY_EVENT: Partial<Record<InternalEscrowEvent, EventNotice>> = {
  'escrow.accepted': {
    recipient: 'creator',
    gig: { title: 'Gig accepted', body: 'A worker accepted your gig, work is underway.' },
    exchange: { title: 'Offer accepted', body: 'A buyer accepted your offer. Waiting for their payment.' },
  },
  // Approval mode: the worker signs NOTHING to be assigned, so this push is
  // the only moment they can learn the gig is theirs. Without it the mode is
  // unusable — they would have to happen to reopen the app.
  'escrow.counterparty_assigned': {
    recipient: 'counterparty',
    gig: { title: 'You got the gig', body: 'The poster assigned you. Open it to see what to deliver and by when.' },
    exchange: { title: 'You were matched', body: 'The seller matched you to their offer. Open it to continue.' },
  },
  // Symmetrically: they were placed without acting, so they must be told when
  // that is undone — otherwise they keep working on a gig they no longer hold.
  'escrow.assignment_released': {
    recipient: 'counterparty',
    gig: { title: 'Assignment withdrawn', body: 'The poster released your assignment. The gig is open to others again.' },
    exchange: { title: 'Match withdrawn', body: 'The seller released your match. The offer is open to others again.' },
  },
  'escrow.declined': {
    recipient: 'creator',
    gig: { title: 'Assignment declined', body: 'Your assigned worker declined. The gig is now open to everyone.' },
    exchange: { title: 'Offer declined', body: 'The assigned buyer declined. Your offer is open to everyone again.' },
  },
  'escrow.proof_submitted': {
    recipient: 'creator',
    gig: { title: 'Work submitted', body: 'Proof of completion is in, review and approve to release payment.' },
    exchange: { title: 'Payment marked as sent', body: 'The buyer marked the payment as sent. Confirm receipt to release the crypto.' },
  },
  'escrow.approved': {
    recipient: 'counterparty',
    gig: { title: 'Payment released', body: 'The poster approved your work. Funds are in your wallet.' },
    exchange: { title: 'Crypto released', body: 'The seller confirmed your payment. The crypto is in your wallet.' },
  },
  'escrow.payment_claimed': {
    recipient: 'creator',
    gig: { title: 'Payment auto-claimed', body: 'The approval window passed, so the worker claimed payment.' },
    exchange: { title: 'Crypto auto-claimed', body: 'The confirmation window passed, so the buyer claimed the crypto.' },
  },
  'escrow.abandoned': {
    recipient: 'counterparty',
    gig: { title: 'Escrow reclaimed', body: 'The poster reclaimed the escrow after the completion window passed.' },
    exchange: { title: 'Offer reclaimed', body: 'The payment window passed, so the seller reclaimed their crypto.' },
  },
  'escrow.dispute_raised': {
    recipient: 'both',
    gig: { title: 'Dispute opened', body: 'A dispute was raised on your escrow. Our team will review it.' },
    exchange: { title: 'Dispute opened', body: 'A dispute was raised on your trade. Our team will review it.' },
  },
  'escrow.dispute_resolved': {
    recipient: 'both',
    gig: { title: 'Dispute resolved', body: 'Your dispute has been resolved, check the escrow for the outcome.' },
    exchange: { title: 'Dispute resolved', body: 'Your dispute has been resolved, check the trade for the outcome.' },
  },
}

/** Exported for direct unit testing of the copy matrix. */
export function escrowNoticeFor(
  event: InternalEscrowEvent,
  kind: EscrowKind,
): (NoticeCopy & { recipient: EventNotice['recipient'] }) | null {
  const notice = NOTICE_BY_EVENT[event]
  if (notice === undefined) return null
  const copy = kind === 'exchange' ? notice.exchange : notice.gig
  return { recipient: notice.recipient, ...copy }
}

/**
 * New-gig fan-out: when the on-chain create confirms (escrow → open), notify
 * gig_subscriptions matching the gig's city/category ('*' = any-value sentinel).
 * Exchanges have no gig_details row and no subscription table, so this is a
 * no-op for them (the early return in fanOutEscrowEvent never reaches here).
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
  // Exchange escrows have no gig_details row, nothing to fan out.
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
    await enqueueNotification(fastify.queue, {
      user_id,
      title: 'New Gig Posted',
      body: `"${gig.title}" in ${gig.city ?? 'Remote'}`,
      data: escrowPushData(escrow_id, 'gig'),
    })
  }
}

export async function fanOutEscrowEvent(
  fastify: FastifyInstance,
  event: EscrowFanoutEvent,
): Promise<void> {
  // 1. Live WS frame, matches shared EscrowEventFrame exactly.
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

  // 3. Push fan-out for high-signal events — kind decides both copy + routing.
  if (NOTICE_BY_EVENT[event.internal_event] === undefined) return

  const [row] = await fastify.db
    .select({
      creator_id: escrows.creator_id,
      counterparty_id: escrows.counterparty_id,
      kind: escrows.kind,
    })
    .from(escrows)
    .where(eq(escrows.id, event.escrow_id))
    .limit(1)
  if (row === undefined) return

  const notice = escrowNoticeFor(event.internal_event, row.kind)
  if (notice === null) return

  // Prefer the counterparty the applier resolved over the one on the row:
  // a RELEASED counterparty has already been cleared from the row, so reading
  // it back would address nobody. Falls back to the row for every event that
  // does not carry one.
  const counterparty_id = event.counterparty_id ?? row.counterparty_id
  const recipients =
    notice.recipient === 'both'
      ? [row.creator_id, counterparty_id]
      : notice.recipient === 'creator'
        ? [row.creator_id]
        : [counterparty_id]

  for (const user_id of recipients) {
    if (user_id === null) continue
    await enqueueNotification(fastify.queue, {
      user_id,
      title: notice.title,
      body: notice.body,
      data: escrowPushData(event.escrow_id, row.kind),
    })
  }
}
