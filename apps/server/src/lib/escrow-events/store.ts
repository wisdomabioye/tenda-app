/**
 * Escrow-event store seam + drizzle impl (co-located per the lib convention).
 * The apply is ATOMIC: the status-guarded `escrows` UPDATE, the
 * `escrow_transactions` audit INSERT, and (for DisputeResolved) the `disputes`
 * stamp all commit inside ONE db.transaction, load-bearing because verify-tx's
 * `isProcessed` dedup keys on the audit row, so the transition and that row must
 * never split across commits.
 */

import { and, eq, inArray, ne } from 'drizzle-orm'
import type { ChainNamespace } from '@tenda/shared/db/schema/chains'
import type { EscrowTxType } from '@tenda/shared'
import { escrows, escrow_transactions, gig_applications } from '@tenda/shared/db/schema/escrow'
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

/** What one atomic apply did, beyond moving the row. */
export interface ApplyEventOutcome {
  /**
   * False when the status guard tripped (another worker already applied); the
   * caller treats that as an idempotent no-op, and neither the audit row nor
   * the dispute stamp was written.
   */
  applied: boolean
  /**
   * Applicants this transition auto-resolved to `passed` (D4). Carried out for
   * the same reason `counterparty_id` is: once committed, nothing downstream
   * can tell WHICH rows this commit settled apart from ones an earlier
   * assign/unassign cycle settled — re-reading would notify people twice.
   */
  passed_applicant_ids: string[]
}

export interface EscrowEventStore {
  /** Apply one event atomically; see file header and ApplyEventOutcome. */
  applyEvent(args: {
    escrow_id: string
    from: EscrowStatus[]
    patch: EscrowPatch
    transaction: EscrowEventTransaction
    disputeResolution?: { winner: 'creator' | 'counterparty' | 'split' }
    /** Settle this applicant's gig application alongside the transition. */
    application?: { applicant_id: string }
  }): Promise<ApplyEventOutcome>
  /** Wallet address → user id on the namespace; null if unknown. */
  resolveUserByWallet(chain_ns: ChainNamespace, address: string): Promise<string | null>
}

export function drizzleEscrowEventStore(db: AppDatabase): EscrowEventStore {
  return {
    async applyEvent({ escrow_id, from, patch, transaction, disputeResolution, application }) {
      // All writes in ONE transaction so the audit row (which isProcessed
      // keys on) can never be lost relative to the status transition.
      return db.transaction(async (tx) => {
        const passed_applicant_ids: string[] = []
        const updated = await tx
          .update(escrows)
          .set(patch)
          .where(and(eq(escrows.id, escrow_id), inArray(escrows.status, from)))
          .returning({ id: escrows.id })
        // Status guard tripped → idempotent no-op, and nothing was settled.
        if (updated.length === 0) return { applied: false, passed_applicant_ids }

        // tx_ref UNIQUE, a replayed insert is a no-op (defence in depth on
        // top of the caller's isProcessed dedup).
        await tx.insert(escrow_transactions).values({ escrow_id, ...transaction }).onConflictDoNothing({
          target: escrow_transactions.tx_ref,
        })

        if (application !== undefined) {
          // Only a LIVE application counts. An assign from a stale or absent
          // one leaves `assigned_from_application` false, so no abandonment
          // strike can follow — the rule is self-correcting rather than
          // trusting the route to have checked.
          const [won] = await tx
            .update(gig_applications)
            .set({ status: 'assigned' })
            .where(
              and(
                eq(gig_applications.escrow_id, escrow_id),
                eq(gig_applications.applicant_id, application.applicant_id),
                eq(gig_applications.status, 'open'),
              ),
            )
            .returning({ id: gig_applications.id })

          if (won !== undefined) {
            await tx
              .update(escrows)
              .set({ assigned_from_application: true })
              .where(eq(escrows.id, escrow_id))
            // D4: everyone else on this gig is resolved automatically, in the
            // same commit, so no applicant is left waiting on a decision that
            // has already been made. The applicant ids come back so the
            // fan-out can tell exactly these people, and nobody else.
            const passed = await tx
              .update(gig_applications)
              .set({ status: 'passed' })
              .where(
                and(
                  eq(gig_applications.escrow_id, escrow_id),
                  eq(gig_applications.status, 'open'),
                  ne(gig_applications.id, won.id),
                ),
              )
              .returning({ applicant_id: gig_applications.applicant_id })
            passed_applicant_ids.push(...passed.map((p) => p.applicant_id))
          }
        }

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
        return { applied: true, passed_applicant_ids }
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
