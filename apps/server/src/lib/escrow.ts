/**
 * Escrow business logic — single home for status transitions, fee math,
 * deadline math, and validation. Replaces the per-domain `lib/gigs.ts` +
 * `lib/exchange.ts` + `lib/disputes.ts` split.
 *
 * State-machine reference: `multichain-migration-stages/stage-0-foundation.md`
 * § state-machine diagram. The transition table here is the executable
 * encoding of that diagram — keep them in sync.
 */

import { AppError } from '@server/lib/errors'
import { ErrorCode } from '@tenda/shared'
import type { AmountRaw, AssetId, ChainId } from '@server/chains/types'

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
 */
export function nextStatus(_ctx: TransitionContext, t: EscrowTransition): EscrowStatus {
  switch (t) {
    case 'publish':
      return 'open'
    case 'accept':
      return 'accepted'
    case 'decline':
      // Decline keeps status `open` — clears the assignment elsewhere. The
      // status itself doesn't change. Per stage-0 § state machine + the EVM
      // contract spec (stage-3-base.md `declineAssignedEscrow`).
      return 'open'
    case 'cancel':
      return 'cancelled'
    case 'refund_expired':
    case 'reclaim_abandoned':
      return 'refunded'
    case 'submit':
      return 'submitted'
    case 'approve':
    case 'claim_stalled':
      return 'completed'
    case 'dispute':
      return 'disputed'
    case 'resolve':
      return 'resolved'
  }
}

/**
 * Throws an `AppError` with a precise code if the transition is disallowed
 * by the state machine, caller, or deadline. Returns `void` on legal
 * transitions — call `nextStatus(ctx, t)` next.
 */
export function assertCanTransition(ctx: TransitionContext, t: EscrowTransition): void {
  switch (t) {
    case 'publish':
      requireStatus(ctx, 'draft', t)
      requireCaller(ctx, ['creator'], t)
      return
    case 'accept':
      requireStatus(ctx, 'open', t)
      if (ctx.is_assigned) {
        requireCaller(ctx, ['assigned_counterparty'], t)
      } else {
        requireCaller(ctx, ['counterparty'], t)
      }
      requireBefore(ctx, ctx.accept_deadline, 'accept_deadline')
      return
    case 'decline':
      requireStatus(ctx, 'open', t)
      if (!ctx.is_assigned) {
        throw new AppError(
          409,
          ErrorCode.ESCROW_WRONG_STATUS,
          `decline requires an assigned counterparty`,
        )
      }
      requireCaller(ctx, ['assigned_counterparty'], t)
      return
    case 'cancel':
      requireStatus(ctx, 'open', t)
      requireCaller(ctx, ['creator'], t)
      return
    case 'refund_expired':
      requireStatus(ctx, 'open', t)
      requireCaller(ctx, ['creator'], t)
      requireAfter(ctx, ctx.accept_deadline, 'accept_deadline')
      return
    case 'submit':
      requireStatus(ctx, 'accepted', t)
      requireCaller(ctx, ['counterparty'], t)
      requireBefore(ctx, addSeconds(ctx.completion_deadline, ctx.grace_period_seconds), 'completion_deadline+grace')
      return
    case 'reclaim_abandoned':
      requireStatus(ctx, 'accepted', t)
      requireCaller(ctx, ['creator'], t)
      requireAfter(ctx, addSeconds(ctx.completion_deadline, ctx.grace_period_seconds), 'completion_deadline+grace')
      return
    case 'dispute':
      if (ctx.status !== 'accepted' && ctx.status !== 'submitted') {
        throw new AppError(
          409,
          ErrorCode.ESCROW_WRONG_STATUS,
          `cannot dispute from status '${ctx.status}'; must be 'accepted' or 'submitted'`,
        )
      }
      requireCaller(ctx, ['creator', 'counterparty'], t)
      return
    case 'approve':
      requireStatus(ctx, 'submitted', t)
      requireCaller(ctx, ['creator'], t)
      return
    case 'claim_stalled':
      requireStatus(ctx, 'submitted', t)
      requireCaller(ctx, ['counterparty'], t)
      requireAfter(ctx, ctx.approval_deadline, 'approval_deadline')
      return
    case 'resolve':
      requireStatus(ctx, 'disputed', t)
      requireCaller(ctx, ['dispute_admin'], t)
      return
  }
}

/** Convenience: assert + map in one call. */
export function transition(ctx: TransitionContext, t: EscrowTransition): EscrowStatus {
  assertCanTransition(ctx, t)
  return nextStatus(ctx, t)
}

// ---------- internal guards ----------------------------------------------

function requireStatus(
  ctx: TransitionContext,
  expected: EscrowStatus,
  t: EscrowTransition,
): void {
  if (ctx.status !== expected) {
    throw new AppError(
      409,
      ErrorCode.ESCROW_WRONG_STATUS,
      `cannot ${t} from status '${ctx.status}'; must be '${expected}'`,
    )
  }
}

function requireCaller(
  ctx: TransitionContext,
  allowed: ReadonlyArray<Caller>,
  t: EscrowTransition,
): void {
  if (!allowed.includes(ctx.caller)) {
    throw new AppError(
      403,
      ErrorCode.ESCROW_WRONG_CALLER,
      `caller '${ctx.caller}' cannot ${t}; allowed: ${allowed.join(', ')}`,
    )
  }
}

function requireBefore(
  ctx: TransitionContext,
  deadline: Date | null,
  label: string,
): void {
  if (deadline === null) {
    throw new AppError(
      500,
      ErrorCode.INTERNAL_ERROR,
      `${label} missing on escrow row — transition requires it`,
    )
  }
  if (ctx.now.getTime() >= deadline.getTime()) {
    throw new AppError(
      409,
      ErrorCode.ESCROW_DEADLINE_PASSED,
      `${label} has passed`,
    )
  }
}

function requireAfter(
  ctx: TransitionContext,
  deadline: Date | null,
  label: string,
): void {
  if (deadline === null) {
    throw new AppError(
      500,
      ErrorCode.INTERNAL_ERROR,
      `${label} missing on escrow row — transition requires it`,
    )
  }
  if (ctx.now.getTime() < deadline.getTime()) {
    throw new AppError(
      409,
      ErrorCode.ESCROW_DEADLINE_NOT_REACHED,
      `${label} not yet reached`,
    )
  }
}

function addSeconds(d: Date | null, seconds: number): Date | null {
  return d === null ? null : new Date(d.getTime() + seconds * 1000)
}

// ---------- fee math ------------------------------------------------------

export interface FeeArgs {
  amount_raw: AmountRaw
  is_seeker: boolean
  fee_bps: number
  seeker_fee_bps: number
}

/**
 * Returns the platform fee in raw units, rounded toward zero.
 * BigInt division truncates toward zero — equivalent to floor for non-negative
 * inputs, which is what we want here (DB CHECK ensures `amount_raw > 0` and
 * `fee_bps ∈ [0, 10000]`).
 */
export function computePlatformFee(args: FeeArgs): AmountRaw {
  const amount = BigInt(args.amount_raw)
  const bps = BigInt(effectiveBps(args))
  return ((amount * bps) / 10_000n).toString()
}

/** Returns `amount - fee` — what the counterparty actually receives. */
export function computeNetPayout(args: FeeArgs): AmountRaw {
  const amount = BigInt(args.amount_raw)
  const fee = BigInt(computePlatformFee(args))
  return (amount - fee).toString()
}

function effectiveBps(args: FeeArgs): number {
  return args.is_seeker ? args.seeker_fee_bps : args.fee_bps
}

// ---------- deadline math ------------------------------------------------

export interface AcceptDeadlineArgs {
  now: Date
  accept_window_seconds: number
}

export function computeAcceptDeadline(a: AcceptDeadlineArgs): Date {
  return new Date(a.now.getTime() + a.accept_window_seconds * 1000)
}

export interface CompletionDeadlineArgs {
  accepted_at: Date
  completion_duration_seconds: number
}

export function computeCompletionDeadline(a: CompletionDeadlineArgs): Date {
  return new Date(a.accepted_at.getTime() + a.completion_duration_seconds * 1000)
}

export interface ApprovalDeadlineArgs {
  submitted_at: Date
  approval_window_seconds: number
}

export function computeApprovalDeadline(a: ApprovalDeadlineArgs): Date {
  return new Date(a.submitted_at.getTime() + a.approval_window_seconds * 1000)
}

// ---------- validation guards -------------------------------------------

/**
 * Canonical USDC asset id per chain — the only asset gigs accept (locked
 * decision #3). Even chains with other stables (cUSD on CELO) restrict gigs
 * to USDC. Exchange escrows have no asset restriction and don't call this.
 *
 * Add a chain here when its `chains` + `assets` rows are seeded (per
 * stage-3-base.md L228, stage-4-celo.md L48). Testnet variants are explicit
 * — Stage 0 cutover targets `solana:devnet`, so it must register before any
 * gig flow exercises it.
 */
// `Partial<Record<...>>` so indexing an unknown chain returns `AssetId | undefined`
// at the type level. Without this, TypeScript would consider the undefined
// check in `assertGigAsset` unreachable. Closes open_issues.md S0-3.
const GIG_ASSET_BY_CHAIN: Readonly<Partial<Record<ChainId, AssetId>>> = {
  'solana:mainnet': 'USDC_SOL',
  'solana:devnet': 'USDC_SOL',
  'eip155:8453': 'USDC_BASE',
  'eip155:84532': 'USDC_BASE',
  'eip155:42220': 'USDC_CELO',
  'eip155:44787': 'USDC_CELO',
}

/**
 * Throws if `asset_id` isn't the gig-eligible USDC variant for `chain_id`.
 * Pure — does not consult the DB. The `assets` table is the canonical source
 * of truth for asset existence; this guard is a narrow policy filter layered
 * on top to enforce "USDC only" for gigs without a per-request DB roundtrip.
 *
 * Throws `ESCROW_INVALID_ASSET` for both unknown chains and wrong assets —
 * route handlers should not distinguish the two (both are user-input errors,
 * not server faults). 422 because the input is well-formed but semantically
 * rejected by business policy.
 */
export function assertGigAsset(asset_id: AssetId, chain_id: ChainId): void {
  const expected = GIG_ASSET_BY_CHAIN[chain_id]
  if (expected === undefined) {
    throw new AppError(
      422,
      ErrorCode.ESCROW_INVALID_ASSET,
      `chain '${chain_id}' is not configured for gig escrows`,
    )
  }
  if (asset_id !== expected) {
    throw new AppError(
      422,
      ErrorCode.ESCROW_INVALID_ASSET,
      `gigs on '${chain_id}' must use '${expected}'; got '${asset_id}'`,
    )
  }
}
