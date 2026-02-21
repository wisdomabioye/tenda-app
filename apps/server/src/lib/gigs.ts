import { eq, and, isNotNull, sql } from 'drizzle-orm'
import { gigs } from '@tenda/shared/db/schema'
import { computeCompletionDeadline, type Gig } from '@tenda/shared'
import type { AppDatabase } from '../plugins/db'
import { getPlatformConfig } from './platform'

// Throttle batch expiry writes to at most once per minute so a busy list
// endpoint doesn't issue a DB write on every single request.
let lastBatchExpiry = 0
const BATCH_EXPIRY_COOLDOWN_MS = 60_000

/**
 * Lazily expire a single gig if its deadlines have passed.
 * Called on GET /v1/gigs/:id to keep the single-record view accurate.
 *
 * Grace period extends the worker's submission window beyond the completion
 * deadline — mirrors the on-chain `completion_deadline + grace_period` check.
 */
export async function checkAndExpireGig(
  gig: Gig,
  db: AppDatabase,
  gracePeriodSeconds: number,
): Promise<Gig> {
  const now = new Date()

  // Open gig whose accept deadline has passed
  if (gig.status === 'open' && gig.accept_deadline && now > gig.accept_deadline) {
    const [updated] = await db
      .update(gigs)
      .set({ status: 'expired', updated_at: now })
      .where(eq(gigs.id, gig.id))
      .returning()
    return updated
  }

  // Accepted gig whose completion deadline + grace period have both passed.
  // Only expire once the full grace window is gone — the worker can still
  // submit proof during the grace period even if the deadline has passed.
  if (gig.status === 'accepted' && gig.accepted_at) {
    const completionDeadline = computeCompletionDeadline(
      new Date(gig.accepted_at),
      gig.completion_duration_seconds,
    )
    const submissionCutoff = new Date(completionDeadline.getTime() + gracePeriodSeconds * 1000)
    if (now > submissionCutoff) {
      const [updated] = await db
        .update(gigs)
        .set({ status: 'expired', updated_at: now })
        .where(eq(gigs.id, gig.id))
        .returning()
      return updated
    }
  }

  return gig
}

/**
 * Batch-expire gigs whose deadlines have passed.
 * Throttled to run at most once per minute across all requests.
 * Called at the start of GET /v1/gigs so the list never serves stale statuses.
 *
 * @todo Replace with a scheduled cron job when traffic warrants it.
 */
export async function batchExpireGigs(db: AppDatabase): Promise<void> {
  const now = Date.now()
  if (now - lastBatchExpiry < BATCH_EXPIRY_COOLDOWN_MS) return
  lastBatchExpiry = now

  const config = await getPlatformConfig(db)
  const nowDate = new Date()

  // 1. Open gigs whose accept deadline has passed
  await db
    .update(gigs)
    .set({ status: 'expired', updated_at: nowDate })
    .where(
      and(
        eq(gigs.status, 'open'),
        isNotNull(gigs.accept_deadline),
        sql`${gigs.accept_deadline} < NOW()`,
      ),
    )

  // 2. Accepted gigs where completion deadline + grace period have both passed.
  // make_interval(secs => n) converts an integer seconds value to a Postgres interval.
  await db
    .update(gigs)
    .set({ status: 'expired', updated_at: nowDate })
    .where(
      and(
        eq(gigs.status, 'accepted'),
        isNotNull(gigs.accepted_at),
        sql`${gigs.accepted_at} + make_interval(secs => ${gigs.completion_duration_seconds} + ${config.grace_period_seconds}) < NOW()`,
      ),
    )
}
