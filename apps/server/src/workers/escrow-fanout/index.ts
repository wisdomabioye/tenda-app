/**
 * Escrow-event push/WS fan-out (extracted from workers/processors.ts to keep
 * it under the file-size budget and to unit-test the copy in isolation).
 *
 * verify-tx republish (stage-2 § listener step 5) calls fanOutEscrowEvent:
 *   1. WS: an `escrow:<id>` frame the TransactionMonitor subscribes to (#42).
 *   2. Push: a 'notifications' job to the party who must LEARN of the event
 *      (the non-actor), resolved from the escrow row.
 *
 * Split into ./copy (the kind-aware wording matrix), ./subscribers (the
 * new-gig SQL fan-out) and ./enqueue-notice (the single delivery loop), with
 * the orchestrator here. Barrel keeps the `@server/workers/escrow-fanout`
 * import surface stable.
 */

import { eq } from 'drizzle-orm'
import type { FastifyInstance } from 'fastify'
import { escrows } from '@tenda/shared/db/schema/escrow'
import { channelName } from '@server/lib/ws'
import type { EscrowRepublishEvent } from '@server/lib/escrow-events'
import { APPLICANT_NOTICE, noticeCopyFor, partyNoticeFor } from './copy'
import { enqueueEscrowNotice } from './enqueue-notice'
import { fanOutNewGigToSubscribers } from './subscribers'

// Named rather than `export *`: `export type` marks what is erased and
// `export` what survives to runtime, and no __exportStar loop is emitted.
export {
  partyNoticeFor,
  noticeCopyFor,
  escrowNoticeFor,
  newGigNotice,
  APPLICANT_NOTICE,
} from './copy'
export type { NoticeCopy, EventNotice, ResolvedNotice } from './copy'

/**
 * The republish payload. Owned by lib/escrow-events so this consumer and
 * verify-tx (the producer) share one declaration instead of two hand-kept
 * copies — re-exported here because every caller of this module already
 * imports the name from it.
 */
export type EscrowFanoutEvent = EscrowRepublishEvent

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

  // 3. Applicants the transition moved without them acting: D4's losers on an
  //    assign, and the rivals an unassign puts back in the running. They get
  //    no other signal — their row simply changes status — so this is the only
  //    place either decision reaches them. Runs before the notice lookup
  //    because it is independent of whether the event has party copy at all.
  //    The two lists are disjoint by construction (one event settles, the
  //    other revives), so nobody receives both for one transition.
  //
  //    The ids come from the applier rather than a fresh query on purpose:
  //    once the commit lands, rows this transition settled look identical to
  //    rows an earlier assign/unassign cycle settled, so re-reading would
  //    notify the same people again every time the poster cycles a worker.
  //    Gig-only by construction — the apply route refuses a non-gig escrow.
  const { escrow_id } = event
  await enqueueEscrowNotice(fastify.queue, escrow_id, 'gig', event.passed_applicant_ids, APPLICANT_NOTICE.passed)
  await enqueueEscrowNotice(fastify.queue, escrow_id, 'gig', event.revived_applicant_ids, APPLICANT_NOTICE.revived)

  // 4. Push fan-out for high-signal events — kind decides both copy + routing.
  //    Looked up before the read so a non-notifying event costs no query.
  const notice = partyNoticeFor(event.internal_event)
  if (notice === null) return

  const [row] = await fastify.db
    .select({
      creator_id: escrows.creator_id,
      counterparty_id: escrows.counterparty_id,
      kind: escrows.kind,
    })
    .from(escrows)
    .where(eq(escrows.id, escrow_id))
    .limit(1)
  if (row === undefined) return

  const copy = noticeCopyFor(notice, row.kind)

  // Prefer the counterparty the applier resolved over the one on the row:
  // a RELEASED counterparty has already been cleared from the row, so reading
  // it back would address nobody. Falls back to the row for every event that
  // does not carry one.
  const counterparty_id = event.counterparty_id ?? row.counterparty_id
  const recipients =
    copy.recipient === 'both'
      ? [row.creator_id, counterparty_id]
      : copy.recipient === 'creator'
        ? [row.creator_id]
        : [counterparty_id]

  await enqueueEscrowNotice(fastify.queue, escrow_id, row.kind, recipients, copy)
}
