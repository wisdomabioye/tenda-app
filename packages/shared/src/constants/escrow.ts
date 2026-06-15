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
 * Maximum digit count an `amount_raw` string may carry — mirrors the
 * `numeric(78,0)` precision of every amount column (db/schema/escrow.ts,
 * identity.ts, fiat.ts, …). Client-supplied amounts are length-checked
 * against this so an over-range value fails validation (422) up front
 * instead of overflowing the column at insert time (a postgres 500).
 */
export const AMOUNT_RAW_PRECISION = 78
