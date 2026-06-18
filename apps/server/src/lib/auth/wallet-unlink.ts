/**
 * Unlink a wallet from a user, atomically. Extracted from the route so the
 * concurrency contract is testable at the DB layer (the route is a thin
 * input-validating wrapper).
 *
 * The whole load → guard → delete runs inside ONE transaction holding a
 * per-user advisory lock, so two concurrent unlinks of DIFFERENT wallets can't
 * each read "2 credentials remain" and both delete, stranding an account with
 * no sign-in method left (TOCTOU). Mirrors the orchestrator's per-email lock.
 *
 * Guards (throw AppError, rolling the tx back):
 *   1. target must be linked to the user (404 NOT_FOUND).
 *   2. never the LAST sign-in method, identities ∪ wallets (409 LAST_CREDENTIAL).
 *   3. not the primary while another wallet remains (409 WALLET_IN_USE).
 *   4. not a party to an active escrow on its namespace (409 WALLET_IN_USE).
 */

import { and, eq, inArray, or, sql } from 'drizzle-orm'
import { ErrorCode } from '@tenda/shared'
import { chains, type ChainNamespace } from '@tenda/shared/db/schema/chains'
import { escrows } from '@tenda/shared/db/schema/escrow'
import { user_wallets } from '@tenda/shared/db/schema/identity'
import { AppError } from '@server/lib/errors'
import { assertNotLastCredential } from '@server/lib/auth/resolver'
import type { AppDatabase } from '@server/plugins/db'

/** Escrow states whose parties still need their wallet's signature. */
const ACTIVE_STATUSES = ['open', 'accepted', 'submitted', 'disputed'] as const

/**
 * Two-key advisory-lock namespace ('tda2') for a user's credential mutations.
 * Disjoint from the single-key test-harness suite lock and the orchestrator's
 * per-email lock (NS 'tda1', `pg_advisory_xact_lock(int4, int4)` space).
 */
const WALLET_UNLINK_LOCK_NS = 0x74_64_61_32

export async function unlinkWallet(
  db: AppDatabase,
  args: { userId: string; chain_ns: ChainNamespace; address: string },
): Promise<void> {
  const { userId, chain_ns, address } = args
  await db.transaction(async (tx) => {
    await tx.execute(
      sql`select pg_advisory_xact_lock(${WALLET_UNLINK_LOCK_NS}::int4, hashtext(${userId}))`,
    )

    const wallets = await tx
      .select({
        chain_ns: user_wallets.chain_ns,
        address: user_wallets.address,
        is_primary: user_wallets.is_primary,
      })
      .from(user_wallets)
      .where(eq(user_wallets.user_id, userId))

    const target = wallets.find((w) => w.chain_ns === chain_ns && w.address === address)
    if (target === undefined) {
      throw new AppError(404, ErrorCode.NOT_FOUND, 'wallet not linked to this account')
    }
    // Never strand the account — block only if this wallet is the last sign-in
    // method overall (a remaining email/phone makes it safe).
    await assertNotLastCredential(tx, userId)
    // Re-designate a primary first, but only when another wallet remains —
    // removing the sole wallet leaves no primary to maintain.
    if (target.is_primary && wallets.length > 1) {
      throw new AppError(
        409,
        ErrorCode.WALLET_IN_USE,
        'set another wallet as primary before unlinking this one',
      )
    }

    // Active escrows on this namespace bind the wallet's signing ability.
    const active = await tx
      .select({ id: escrows.id })
      .from(escrows)
      .innerJoin(chains, eq(escrows.chain_id, chains.id))
      .where(
        and(
          eq(chains.namespace, chain_ns),
          inArray(escrows.status, [...ACTIVE_STATUSES]),
          or(eq(escrows.creator_id, userId), eq(escrows.counterparty_id, userId)),
        ),
      )
    if (active.length > 0) {
      throw new AppError(409, ErrorCode.WALLET_IN_USE, 'wallet is a party to active escrows', {
        escrow_ids: active.map((e) => e.id),
      })
    }

    await tx
      .delete(user_wallets)
      .where(
        and(
          eq(user_wallets.user_id, userId),
          eq(user_wallets.chain_ns, chain_ns),
          eq(user_wallets.address, address),
        ),
      )
  })
}
