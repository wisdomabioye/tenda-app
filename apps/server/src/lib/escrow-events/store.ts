/**
 * Escrow-event store seam + drizzle impl (co-located per the lib convention).
 * The apply is ATOMIC: the status-guarded `escrows` UPDATE, the
 * `escrow_transactions` audit INSERT, and (for DisputeResolved) the `disputes`
 * stamp all commit inside ONE db.transaction — load-bearing because verify-tx's
 * `isProcessed` dedup keys on the audit row, so the transition and that row must
 * never split across commits.
 */

import { and, eq, inArray } from 'drizzle-orm'
import type { ChainNamespace } from '@tenda/shared/db/schema/chains'
import type { EscrowTxType } from '@tenda/shared'
import { escrows, escrow_transactions } from '@tenda/shared/db/schema/escrow'
import { disputes } from '@tenda/shared/db/schema/governance'
import { user_wallets } from '@tenda/shared/db/schema/identity'
import type { AppDatabase } from '@server/plugins/db'
import type { EscrowStatus } from '@server/lib/escrow'

/** Column patch applied alongside the status guard. */
export interface EscrowPatch {
  status?: EscrowStatus
  escrow_ref?: string
  counterparty_id?: string | null
  assigned_counterparty_id?: string | null
  completion_deadline?: Date
  submitted_at?: Date
  approval_deadline?: Date
}

/** Audit row recorded alongside every applied transition. */
export interface EscrowEventTransaction {
  type: EscrowTxType
  tx_ref: string
  amount_raw: string | null
  platform_fee_raw: string | null
  actor_id: string | null
}

export interface EscrowEventStore {
  /**
   * Apply one event atomically (see file header). Returns false when the
   * status guard trips (another worker already applied) — the caller treats
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
        if (updated.length === 0) return false // status guard tripped — idempotent no-op

        // tx_ref UNIQUE — a replayed insert is a no-op (defence in depth on
        // top of the caller's isProcessed dedup).
        await tx.insert(escrow_transactions).values({ escrow_id, ...transaction }).onConflictDoNothing({
          target: escrow_transactions.tx_ref,
        })

        if (disputeResolution !== undefined) {
          await tx
            .update(disputes)
            .set({ winner: disputeResolution.winner, resolved_at: new Date() })
            .where(eq(disputes.escrow_id, escrow_id))
        }
        return true
      })
    },
    async resolveUserByWallet(chain_ns, address) {
      const rows = await db
        .select({ user_id: user_wallets.user_id })
        .from(user_wallets)
        .where(and(eq(user_wallets.chain_ns, chain_ns), eq(user_wallets.address, address)))
        .limit(1)
      return rows[0]?.user_id ?? null
    },
  }
}
