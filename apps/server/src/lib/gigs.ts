import { eq, and, isNotNull, sql } from 'drizzle-orm'
import { gigs } from '@tenda/shared/db/schema'
import { computeCompletionDeadline, ErrorCode, type Gig, type GigStatus } from '@tenda/shared'

import type { AppDatabase } from '@server/plugins/db'
import { getPlatformConfig } from './platform'
import { AppError } from './errors'

/**
 * Fetches a gig by id. Throws a 404 AppError if not found.
 */
export async function ensureGigExists(db: AppDatabase, id: string): Promise<Gig> {
  const [gig] = await db.select().from(gigs).where(eq(gigs.id, id)).limit(1)
  if (!gig) throw new AppError(404, ErrorCode.GIG_NOT_FOUND, 'Gig not found')
  return gig
}

/**
 * Throws a 400 AppError if the gig is not in one of the allowed statuses.
 */
export function ensureGigStatus(gig: Pick<Gig, 'status'>, ...allowed: GigStatus[]): void {
  if (!allowed.includes(gig.status as GigStatus)) {
    throw new AppError(400, ErrorCode.GIG_WRONG_STATUS, `Gig must be ${allowed.join(' or ')} to perform this action`)
  }
}

/**
 * Throws a 403 AppError if userId does not match the expected role on the gig.
 * role 'poster'  — checks poster_id === userId
 * role 'worker'  — checks worker_id === userId
 */
export function ensureGigOwnership(
  gig: Pick<Gig, 'poster_id' | 'worker_id'>,
  userId: string,
  role: 'poster' | 'worker',
  message?: string,
): void {
  const ok = role === 'poster' ? gig.poster_id === userId : gig.worker_id === userId
  if (!ok) throw new AppError(403, ErrorCode.FORBIDDEN, message ?? `Only the ${role} can perform this action`)
}

/**
 * Throws a 409 AppError if a TOCTOU-guarded DB update returned no row.
 * Use after transactions that include a status guard in the WHERE clause.
 */
export function ensureTxUpdated<T>(result: T | null | undefined, message: string): T {
  if (result == null) throw new AppError(409, ErrorCode.GIG_WRONG_STATUS, message)
  return result
}

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
      .where(and(eq(gigs.id, gig.id), eq(gigs.status, 'open')))
      .returning()
    return updated ?? gig
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
        .where(and(eq(gigs.id, gig.id), eq(gigs.status, 'accepted')))
        .returning()
      return updated ?? gig
    }
  }

  return gig
}

interface BatchExpireLogger {
  info(obj: object, msg: string): void
  error(obj: object, msg: string): void
}

/**
 * Batch-expire gigs whose deadlines have passed.
 * Throttled to run at most once per minute across all requests.
 * Called at the start of GET /v1/gigs so the list never serves stale statuses.
 *
 * @todo Replace with a scheduled cron job when traffic warrants it.
 */
export async function batchExpireGigs(db: AppDatabase, log: BatchExpireLogger): Promise<void> {
  const now = Date.now()
  if (now - lastBatchExpiry < BATCH_EXPIRY_COOLDOWN_MS) return
  lastBatchExpiry = now

  const config = await getPlatformConfig(db)
  const nowDate = new Date()

  try {
    // 1. Open gigs whose accept deadline has passed
    const expired1 = await db
      .update(gigs)
      .set({ status: 'expired', updated_at: nowDate })
      .where(
        and(
          eq(gigs.status, 'open'),
          isNotNull(gigs.accept_deadline),
          sql`${gigs.accept_deadline} < NOW()`,
        ),
      )
      .returning({ id: gigs.id })

    // 2. Accepted gigs where completion deadline + grace period have both passed.
    // make_interval(secs => n) converts an integer seconds value to a Postgres interval.
    const expired2 = await db
      .update(gigs)
      .set({ status: 'expired', updated_at: nowDate })
      .where(
        and(
          eq(gigs.status, 'accepted'),
          isNotNull(gigs.accepted_at),
          sql`${gigs.accepted_at} + make_interval(secs => ${gigs.completion_duration_seconds} + ${config.grace_period_seconds}) < NOW()`,
        ),
      )
      .returning({ id: gigs.id })

    const total = expired1.length + expired2.length
    if (total > 0) {
      log.info({ expiredOpen: expired1.length, expiredAccepted: expired2.length }, `batchExpireGigs: expired ${total} gig(s)`)
    }
  } catch (err) {
    log.error({ err }, 'batchExpireGigs: UPDATE failed')
  }
}
