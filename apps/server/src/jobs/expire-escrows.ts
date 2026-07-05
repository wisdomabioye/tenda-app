/**
 * expire-escrows repeatable job (stage-0-foundation.md § Infrastructure:
 * every 60s). Replaces the legacy request-path lazy expiry
 * (`lib/gigs.ts:checkAndExpireGig`) once the cutover removes it.
 *
 * v2 semantics: there is NO `expired` status, `escrows.status` is a
 * faithful mirror of on-chain state, and the chain keeps an unaccepted
 * escrow `Open` until the creator pulls `refund_expired`. What expiry means
 * server-side is therefore:
 *   1. Listings exclude open escrows past `accept_deadline` at query time
 *      (listing-route concern, cutover §3).
 *   2. This job nudges creators to reclaim: one notification per expired
 *      escrow, made idempotent by a deterministic BullMQ job_id, re-ticks
 *      never re-notify.
 *
 * The repeatable scheduling + worker wiring land with #33 (Redis); the
 * handler is complete and tested now, same pattern as jobs/verify-tx.ts.
 */

import { and, eq, gte, isNull, lt } from 'drizzle-orm'
import { escrows } from '@tenda/shared/db/schema'
import type { JobPayload, QueueService } from '@server/plugins/queue'
import type { AppDatabase } from '@server/plugins/db'

// ---------- store abstraction --------------------------------------------

export interface ExpiredOpenEscrow {
  id: string
  kind: 'gig' | 'exchange'
  creator_id: string
}

export interface ExpireEscrowsStore {
  /**
   * Open, never-accepted escrows whose accept_deadline fell inside
   * `[since, until)`. The bounded window is the idempotency backbone: an
   * unclaimed escrow stays `open` in the DB indefinitely, and BullMQ job_id
   * dedup only holds while the completed notification job is retained, so
   * an unbounded "deadline < now" scan would re-notify every tick once the
   * job is pruned. A row can only match while its deadline is inside the
   * window; the deterministic job_id absorbs the overlap between ticks.
   */
  findNewlyExpiredOpen(since: Date, until: Date, limit: number): Promise<ExpiredOpenEscrow[]>
}

export function drizzleExpireEscrowsStore(db: AppDatabase): ExpireEscrowsStore {
  return {
    async findNewlyExpiredOpen(since, until, limit) {
      return db
        .select({ id: escrows.id, kind: escrows.kind, creator_id: escrows.creator_id })
        .from(escrows)
        .where(
          and(
            eq(escrows.status, 'open'),
            isNull(escrows.counterparty_id),
            gte(escrows.accept_deadline, since),
            lt(escrows.accept_deadline, until),
          ),
        )
        .orderBy(escrows.accept_deadline)
        .limit(limit)
    },
  }
}

// ---------- handler -------------------------------------------------------

/** Rows scanned per tick. Overflow is logged and picked up next tick. */
export const EXPIRE_BATCH_LIMIT = 200

/**
 * How far back a tick looks for newly-crossed deadlines. Covers worker
 * restarts/outages up to this long; older missed nudges are deliberately
 * skipped (a stale "your gig just expired" push is worse than none).
 * Must exceed the tick interval (60s) so consecutive windows overlap.
 *
 * #33 worker-config constraint: completed `notifications` jobs must be
 * retained (removeOnComplete age) for at least this long, the job_id
 * dedup covers the window overlap only while the prior job still exists.
 */
export const EXPIRE_LOOKBACK_MS = 5 * 60_000

/** Deterministic notification job id, the idempotency guarantee. */
export function expireNoticeJobId(escrow_id: string): string {
  return `expire-notice:${escrow_id}`
}

export interface ExpireEscrowsLogger {
  info(obj: Record<string, unknown>, msg: string): void
  warn(obj: Record<string, unknown>, msg: string): void
}

export interface ExpireEscrowsDeps {
  store: ExpireEscrowsStore
  queue: Pick<QueueService, 'enqueue'>
  log: ExpireEscrowsLogger
  /** Injected clock so deadline-edge tests are deterministic. */
  now(): Date
}

export interface ExpireEscrowsResult {
  scanned: number
  enqueued: number
}

const NOTICE_COPY: Record<ExpiredOpenEscrow['kind'], { title: string; body: string }> = {
  gig: {
    title: 'Your gig expired',
    body: 'Nobody accepted before the deadline. Reclaim your escrowed funds from the gig page.',
  },
  exchange: {
    title: 'Your exchange offer expired',
    body: 'Nobody accepted before the deadline. Reclaim your escrowed funds from the offer page.',
  },
}

export async function handleExpireEscrows(
  deps: ExpireEscrowsDeps,
  payload: JobPayload['expire-escrows'],
): Promise<ExpireEscrowsResult> {
  const until = deps.now()
  const since = new Date(until.getTime() - EXPIRE_LOOKBACK_MS)
  const rows = await deps.store.findNewlyExpiredOpen(since, until, EXPIRE_BATCH_LIMIT)

  let enqueued = 0
  for (const row of rows) {
    const copy = NOTICE_COPY[row.kind]
    await deps.queue.enqueue(
      'notifications',
      {
        user_id: row.creator_id,
        title: copy.title,
        body: copy.body,
        data: { escrow_id: row.id, kind: row.kind, reason: 'expired' },
      },
      { job_id: expireNoticeJobId(row.id) },
    )
    enqueued += 1
  }

  if (rows.length === EXPIRE_BATCH_LIMIT) {
    // No silent caps: surface that this tick did not drain the backlog.
    deps.log.warn(
      { tick_id: payload.tick_id, limit: EXPIRE_BATCH_LIMIT },
      'expire-escrows: batch limit hit, remainder picked up next tick',
    )
  }
  deps.log.info(
    { tick_id: payload.tick_id, scanned: rows.length, enqueued },
    'expire-escrows tick complete',
  )
  return { scanned: rows.length, enqueued }
}
