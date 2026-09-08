/**
 * The demo account's DRAFT RING (#147).
 *
 * `POST /v1/agent/demo-session` hands anyone a bearer for one shared account
 * (#108), and every task that bearer posts mints a draft. Nothing ever
 * deleted drafts: expire, sweep and reconcile act on funded escrows and
 * pending attempts, and the pending-gig cap counts work a WORKER accepted.
 * MEASURED 2026-09-07: four review runs, four drafts, forever — an unbounded
 * row sink on a keyless endpoint, each row moderated at creation and never
 * revisited.
 *
 * A plain cap would refuse the mint past N — and, with nothing deleting, the
 * demo would die for good the day it filled, in the middle of the next review
 * round. So this is a RING: before the demo account mints a new draft, its
 * oldest unfunded drafts beyond the cap are discarded. A demo needs one draft
 * to be quoted terms against, not a history. Only the demo account is
 * touched, only its DRAFTS, and never one with a create in flight — the same
 * three guards DELETE /v1/escrows/:id applies before a person discards one.
 *
 * The cap is `AGENT_DEMO_DRAFT_CAP`, default below: well above the ten
 * reviewers a round runs concurrently, so no live session is evicted, and
 * small enough to bound the table.
 */
import { and, desc, eq, inArray, isNull, notExists } from 'drizzle-orm'
import { escrows, tx_attempts, user_wallets } from '@tenda/shared/db/schema'
import type { AppDatabase } from '@server/plugins/db'
import { normalizeWalletAddress } from '@server/lib/auth/wallet-address'

export const DEMO_DRAFT_CAP_DEFAULT = 20

/**
 * Whether `user_id` IS the demo account: the holder of the configured demo
 * address. Null config means no demo, so no account is one.
 */
export async function isDemoAccount(
  db: AppDatabase,
  user_id: string,
  configuredAddress: string | null,
): Promise<boolean> {
  if (configuredAddress === null) return false
  const [held] = await db
    .select({ user_id: user_wallets.user_id })
    .from(user_wallets)
    .where(
      and(
        eq(user_wallets.user_id, user_id),
        eq(user_wallets.chain_ns, 'eip155'),
        eq(user_wallets.address, normalizeWalletAddress('eip155', configuredAddress)),
      ),
    )
    .limit(1)
  return held !== undefined
}

/** A draft whose create is awaiting confirmation is not abandoned; it is never rung out. */
function noCreateInFlight(db: AppDatabase) {
  return notExists(
    db
      .select({ id: tx_attempts.id })
      .from(tx_attempts)
      .where(
        and(
          eq(tx_attempts.escrow_id, escrows.id),
          eq(tx_attempts.action, 'create'),
          isNull(tx_attempts.confirmed_at),
          isNull(tx_attempts.failed_at),
        ),
      ),
  )
}

/**
 * Discard this user's oldest unfunded drafts so that at most `keep` remain.
 * Newest first by creation, id as the tiebreak so two drafts minted in the
 * same millisecond still order deterministically. Answers how many went, for
 * the caller's log.
 */
export async function evictDraftsBeyond(
  db: AppDatabase,
  args: { user_id: string; keep: number },
): Promise<number> {
  const surplus = await db
    .select({ id: escrows.id })
    .from(escrows)
    .where(and(eq(escrows.creator_id, args.user_id), eq(escrows.status, 'draft'), noCreateInFlight(db)))
    .orderBy(desc(escrows.created_at), desc(escrows.id))
    .offset(Math.max(0, args.keep))
  if (surplus.length === 0) return 0
  // Status re-asserted inside the DELETE, as the discard route does: a create
  // confirming between the SELECT and here (draft → open) must not be erased.
  const deleted = await db
    .delete(escrows)
    .where(
      and(
        inArray(escrows.id, surplus.map((row) => row.id)),
        eq(escrows.status, 'draft'),
      ),
    )
    .returning({ id: escrows.id })
  return deleted.length
}
