/**
 * Escrow-event store seam + drizzle impl (co-located per the lib convention).
 * The apply is ATOMIC: the status-guarded `escrows` UPDATE, the
 * `escrow_transactions` audit INSERT, and (for DisputeResolved) the `disputes`
 * stamp all commit inside ONE db.transaction, load-bearing because verify-tx's
 * `isProcessed` dedup keys on the audit row, so the transition and that row must
 * never split across commits.
 */

import { and, eq, inArray } from 'drizzle-orm'
import type { ChainNamespace } from '@tenda/shared/db/schema/chains'
import type { EscrowTxType } from '@tenda/shared'
import { escrows, escrow_transactions } from '@tenda/shared/db/schema/escrow'
import { disputes, dispute_resolutions } from '@tenda/shared/db/schema/governance'
import { user_wallets } from '@tenda/shared/db/schema/identity'
import { walletAddressEquals } from '@server/lib/auth/wallet-address'
import type { AppDatabase } from '@server/plugins/db'
import type { EscrowStatus } from '@server/lib/escrow'

/** Column patch applied alongside the status guard. */
export interface EscrowPatch {
  status?: EscrowStatus
  escrow_ref?: string
  counterparty_id?: string | null
  assigned_counterparty_id?: string | null
  /**
   * `null` CLEARS the column — AssignmentReleased rewinds an escrow to `open`
   * and its completion deadline must go with it, or the expiry sweep would
   * keep judging an escrow nobody is working on against a dead deadline.
   */
  completion_deadline?: Date | null
  submitted_at?: Date
  approval_deadline?: Date
}

/** Audit row recorded alongside every applied transition. */
export interface EscrowEventTransaction {
  type: EscrowTxType
  tx_ref: string
  amount_raw: string | null
  platform_fee_raw: string | null
  /** Resolve rows only: the creator's principal share (see schema note). */
  creator_payout_raw: string | null
  actor_id: string | null
}

export interface EscrowEventStore {
  /**
   * Apply one event atomically (see file header). Returns false when the
   * status guard trips (another worker already applied), the caller treats
   * that as an idempotent no-op, and neither the audit row nor the dispute
   * stamp is written.
   */
  applyEvent(args: {
    escrow_id: string
    from: EscrowStatus[]
    patch: EscrowPatch
    transaction: EscrowEventTransaction
    disputeResolution?: { winner: 'creator' | 'counterparty' | 'split' }
  }): Promise<boolean>
  /** Wallet address → user id on the namespace; null if unknown. */
  resolveUserByWallet(chain_ns: ChainNamespace, address: string): Promise<string | null>
}

export function drizzleEscrowEventStore(db: AppDatabase): EscrowEventStore {
  return {
    async applyEvent({ escrow_id, from, patch, transaction, disputeResolution }) {
      // All writes in ONE transaction so the audit row (which isProcessed
      // keys on) can never be lost relative to the status transition.
      return db.transaction(async (tx) => {
        const updated = await tx
          .update(escrows)
          .set(patch)
          .where(and(eq(escrows.id, escrow_id), inArray(escrows.status, from)))
          .returning({ id: escrows.id })
        if (updated.length === 0) return false // status guard tripped, idempotent no-op

        // tx_ref UNIQUE, a replayed insert is a no-op (defence in depth on
        // top of the caller's isProcessed dedup).
        await tx.insert(escrow_transactions).values({ escrow_id, ...transaction }).onConflictDoNothing({
          target: escrow_transactions.tx_ref,
        })

        if (disputeResolution !== undefined) {
          const [stamped] = await tx
            .update(disputes)
            .set({ winner: disputeResolution.winner, resolved_at: new Date() })
            .where(eq(disputes.escrow_id, escrow_id))
            .returning({ id: disputes.id })
          // On-chain finality is the ONLY thing that confirms a proposal
          // (Issue-3): flip the active proposal, if any, in the same commit.
          // A no-op when resolution went through CLI/direct-resolve instead.
          if (stamped !== undefined) {
            await tx
              .update(dispute_resolutions)
              .set({ status: 'confirmed', resolved_tx_ref: transaction.tx_ref })
              .where(
                and(
                  eq(dispute_resolutions.dispute_id, stamped.id),
                  inArray(dispute_resolutions.status, ['pending', 'executing']),
                ),
              )
          }
        }
        return true
      })
    },
    async resolveUserByWallet(chain_ns, address) {
      // The address comes from decoded on-chain event data, viem returns EVM
      // addresses EIP-55 checksummed. Match case-insensitively (EVM) so the
      // counterparty/actor resolves regardless of the stored row's case.
      const rows = await db
        .select({ user_id: user_wallets.user_id })
        .from(user_wallets)
        .where(and(eq(user_wallets.chain_ns, chain_ns), walletAddressEquals(chain_ns, address)))
        .limit(1)
      return rows[0]?.user_id ?? null
    },
  }
}
