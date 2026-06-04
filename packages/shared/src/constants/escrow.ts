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
