/**
 * v2 escrow transaction-type vocabulary (snake_case — matches
 * `escrow_transactions.type` / `tx_attempts.action` enums and the
 * client-ping wire format). Single source shared by server and mobile so
 * the action names can never drift between the two.
 */
export const ESCROW_TX_TYPES = [
  'create',
  'accept',
  'decline',
  'submit',
  'approve',
  'claim_stalled',
  'cancel',
  'refund_expired',
  'reclaim_abandoned',
  'dispute',
  'resolve',
] as const

export type EscrowTxType = (typeof ESCROW_TX_TYPES)[number]

export function isEscrowTxType(v: unknown): v is EscrowTxType {
  return typeof v === 'string' && (ESCROW_TX_TYPES as readonly string[]).includes(v)
}

/**
 * Accept window stamped when a draft is (re)given a publish path: the
 * mobile create flows' default, the window fiat-rails stamps on
 * server-opened sell offers, and the refresh build-create applies to a
 * draft whose deadline lapsed before publishing.
 */
export const DEFAULT_ACCEPT_WINDOW_SECONDS = 7 * 24 * 60 * 60

/**
 * Selectable accept-window options (in hours) for the create flows — how long
 * an escrow stays open for a counterparty to accept. Shared by the gig form and
 * the exchange offer form (both are escrows); the server only requires a future
 * timestamp, so this is purely the client's option set. '30d' is the long-tail
 * option that replaced the legacy 'No limit'.
 */
export const ACCEPT_DEADLINE_OPTIONS: readonly { label: string; hours: number }[] = [
  { label: '12h', hours: 12 },
  { label: '24h', hours: 24 },
  { label: '48h', hours: 48 },
  { label: '3d', hours: 72 },
  { label: '7d', hours: 168 },
  { label: '30d', hours: 720 },
]

/**
 * Maximum digit count an `amount_raw` string may carry — mirrors the
 * `numeric(78,0)` precision of every amount column (db/schema/escrow.ts,
 * identity.ts, fiat.ts, …). Client-supplied amounts are length-checked
 * against this so an over-range value fails validation (422) up front
 * instead of overflowing the column at insert time (a postgres 500).
 */
export const AMOUNT_RAW_PRECISION = 78

/**
 * Canonical escrow lifecycle status order. The INDEX is the on-chain `uint8`
 * wire value on every chain — the EVM `Status` enum and the Anchor
 * `EscrowStatus` enum both number their variants in exactly this order. This
 * is the single app-side source the server decodes EVM receipts against; the
 * `check-contract-parity` guard asserts it equals both contracts' enums, so a
 * contract reorder (invisible to the ABI, which renders enums as bare `uint8`)
 * fails CI instead of silently mis-decoding.
 */
export const ESCROW_STATUS_ORDER = [
  'open',
  'accepted',
  'submitted',
  'completed',
  'cancelled',
  'refunded',
  'disputed',
  'resolved',
] as const

export type EscrowStatusName = (typeof ESCROW_STATUS_ORDER)[number]

/**
 * Statuses that count as POSTED — every status an escrow can hold once it
 * exists on-chain. `draft` is the sole off-chain status (a pre-signature
 * staging row that was never funded), so the posted set is exactly
 * `ESCROW_STATUS_ORDER`: a gig is "posted" when its create tx confirmed, not
 * when a draft row was written.
 *
 * Aliased rather than hand-listed so a new status can't be forgotten here.
 * The premise "draft is the only off-chain status" is pinned by
 * test/constants/escrow.ts against the DB enum, which fails if that ever
 * stops holding.
 *
 * Used as the `?status=` filter behind the My Gigs "Posted" tab and the
 * profile's posted count — both of which counted drafts before, so a
 * half-finished create inflated the number the user reads as "gigs I posted".
 */
export const POSTED_ESCROW_STATUSES = ESCROW_STATUS_ORDER

/** Escrow kind → on-chain `uint8` (EVM `KIND_*`, Anchor `EscrowKind`). */
export const ESCROW_KIND_CODE = { gig: 0, exchange: 1 } as const

export type EscrowKindName = keyof typeof ESCROW_KIND_CODE

/** Dispute winner → on-chain `uint8` (EVM `WINNER_*`, Anchor `DisputeWinner`). */
export const DISPUTE_WINNER_CODE = { creator: 0, counterparty: 1, split: 2 } as const

export type DisputeWinnerName = keyof typeof DISPUTE_WINNER_CODE

/**
 * Protocol limits enforced ON-CHAIN by both contracts (EVM `TendaEscrow.sol`
 * constants + Anchor `constants.rs`). Single app-side source so off-chain
 * validation (e.g. the admin platform-config caps) can never be looser than
 * what the chain accepts — an over-limit value the contract would revert must
 * fail server-side first. The `check-contract-parity` guard asserts these
 * equal both contracts. Durations are in seconds.
 */
export const ESCROW_LIMITS = {
  maxPlatformFeeBps: 1000,
  minApprovalWindowSeconds: 3600,
  maxApprovalWindowSeconds: 30 * 24 * 60 * 60,
  maxGracePeriodSeconds: 14 * 24 * 60 * 60,
  minCompletionDurationSeconds: 3600,
  maxCompletionDurationSeconds: 180 * 24 * 60 * 60,
} as const
