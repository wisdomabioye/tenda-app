/**
 * Escrow business logic — single home for status transitions, fee math,
 * deadline math, and validation. Replaces the per-domain `lib/gigs.ts` +
 * `lib/exchange.ts` + `lib/disputes.ts` split.
 *
 * Status: signatures-only scaffold per Stage 0 first cuts. Implementations
 * land alongside the new collapsed `/v1/escrows/:id/*` routes during the
 * Stage 0 work pass. State-machine reference lives in
 * `multichain-migration-stages/stage-0-foundation.md` § Database.
 *
 * Test coverage owed (see `testing-strategy.md` § Stage 0):
 *   - every transition in `nextStatus()` table
 *   - every guard in `assertCanTransition()` (status + caller + deadline)
 *   - fee math: zero, max, seeker rate, rounding direction
 *   - deadline math: timezone-safe, monotonic
 */

import type { AmountRaw } from '@server/chains/types'

// ---------- state machine -------------------------------------------------

export type EscrowStatus =
  | 'draft'
  | 'open'
  | 'accepted'
  | 'submitted'
  | 'completed'
  | 'cancelled'
  | 'refunded'
  | 'disputed'
  | 'resolved'

export type EscrowTransition =
  | 'publish'
  | 'accept'
  | 'decline'
  | 'submit'
  | 'approve'
  | 'claim_stalled'
  | 'cancel'
  | 'refund_expired'
  | 'reclaim_abandoned'
  | 'dispute'
  | 'resolve'

export type Caller = 'creator' | 'counterparty' | 'assigned_counterparty' | 'dispute_admin'

export interface TransitionContext {
  status: EscrowStatus
  caller: Caller
  now: Date
  accept_deadline: Date | null
  completion_deadline: Date | null
  approval_deadline: Date | null
  /** From `platform_config.grace_period_seconds`. */
  grace_period_seconds: number
  /** True iff `assigned_counterparty_id` is set on the row. */
  is_assigned: boolean
}

/**
 * Pure mapper: given the current state + transition, return the resulting
 * status. **Assumes** the transition is legal — callers MUST first call
 * `assertCanTransition(ctx, t)` (it throws on illegal). Splitting the pure
 * mapping from the legality check keeps each function single-purpose and
 * makes testing the transition table cheap.
 *
 * The full transition table is in stage-0 § Database (state-machine diagram).
 */
export declare function nextStatus(
  ctx: TransitionContext,
  t: EscrowTransition,
): EscrowStatus

// ---------- fee math ------------------------------------------------------

export interface FeeArgs {
  amount_raw: AmountRaw
  is_seeker: boolean
  fee_bps: number
  seeker_fee_bps: number
}

/** Returns the platform fee in raw units, rounded toward zero. */
export declare function computePlatformFee(args: FeeArgs): AmountRaw

/** Returns `amount - fee` — what the counterparty actually receives. */
export declare function computeNetPayout(args: FeeArgs): AmountRaw

// ---------- deadline math ------------------------------------------------

export interface AcceptDeadlineArgs {
  now: Date
  accept_window_seconds: number
}

export declare function computeAcceptDeadline(a: AcceptDeadlineArgs): Date

export interface CompletionDeadlineArgs {
  accepted_at: Date
  completion_duration_seconds: number
}

export declare function computeCompletionDeadline(a: CompletionDeadlineArgs): Date

export interface ApprovalDeadlineArgs {
  submitted_at: Date
  approval_window_seconds: number
}

export declare function computeApprovalDeadline(a: ApprovalDeadlineArgs): Date

// ---------- validation guards (lifted from current route handlers) -------

/**
 * Throws if the asset isn't the USDC variant for the chain. Per locked
 * decision #3, gigs accept USDC only — even if the chain has other stables
 * (e.g. cUSD on CELO), they're not gig-eligible.
 */
export declare function assertGigAsset(asset_id: string, chain_id: string): void

/** Throws if the requested transition violates the state-machine table. */
export declare function assertCanTransition(
  ctx: TransitionContext,
  t: EscrowTransition,
): void
