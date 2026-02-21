import { eq } from 'drizzle-orm'
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js'
import { gigs } from '@tenda/shared/db/schema'
import { computeCompletionDeadline, type Gig } from '@tenda/shared'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Database = PostgresJsDatabase<any>

/**
 * Lazily expire a gig if its accept or completion deadline has passed.
 * Returns the (possibly updated) gig record.
 *
 * @todo Replace per-request lazy check with a background cron job when scaling.
 */
export async function checkAndExpireGig(gig: Gig, db: Database): Promise<Gig> {
  const now = new Date()

  if (gig.status === 'open' && gig.accept_deadline && now > gig.accept_deadline) {
    const [updated] = await db
      .update(gigs)
      .set({ status: 'expired', updated_at: now })
      .where(eq(gigs.id, gig.id))
      .returning()
    return updated
  }

  if (gig.status === 'accepted' && gig.accepted_at) {
    const deadline = computeCompletionDeadline(
      new Date(gig.accepted_at),
      gig.completion_duration_seconds,
    )
    if (now > deadline) {
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
