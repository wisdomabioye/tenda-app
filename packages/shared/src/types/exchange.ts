/**
 * Exchange READ surface (post-cutover). P2P exchanges are escrows with
 * kind='exchange' — creation and transitions go through /v1/escrows.
 * This file types the order-book browse surface: /v1/exchange (listing,
 * gated by advanced_mode_enabled per decision #14) and /v1/exchange/:id,
 * both served from escrows ⨝ exchange_details.
 */
import type { Dispute, EscrowProof, EscrowStatus } from './escrow'
import type { Review } from './review'
import type { UserRef } from './user'
import type { PayoutRailKind } from '../fiat/payout/types'

// ── Wire projections ──────────────────────────────────────────────────

/** Order-book listing item: escrows ⨝ exchange_details. */
export interface ExchangeSummary {
  /** The escrow id — also the path param for /v1/escrows/:id/* actions. */
  escrow_id: string
  chain_id: string
  asset: string
  amount_raw: string
  status: EscrowStatus
  /** numeric(20,4) — string on the wire. */
  fiat_amount: string
  fiat_currency: string
  /** numeric(30,10) fiat per whole asset unit — string on the wire. */
  rate: string
  payment_window_seconds: number
  accept_deadline: string | null
  created_at: string | null
  creator: UserRef
}

/**
 * The seller's payout account, as revealed to an accepted buyer so they can
 * pay the fiat off-platform. Carries the FULL account_number (unlike the
 * owner-facing masked BankAccountSummary) — a matched buyer needs it to
 * transfer. Server exposes it ONLY to the offer's parties; null otherwise.
 */
export interface ExchangePayoutAccount {
  kind: PayoutRailKind
  bank_code: string
  account_number: string
  account_name: string
  country: string
}

export interface ExchangeDetail extends ExchangeSummary {
  payment_proof_url: string | null
  dispute_bond_raw: string
  completion_deadline: string | null
  submitted_at: string | null
  approval_deadline: string | null
  counterparty: UserRef | null
  proofs: EscrowProof[]
  dispute: Dispute | null
  reviews: Review[]
  /** Seller's payout account — present only for the offer's parties. */
  payout_account: ExchangePayoutAccount | null
}

// ── Create-detail satellite (CO4 advanced-mode offer creation) ─────────

/**
 * POST /v1/exchange — attach exchange_details to the caller's DRAFT
 * escrow (mirror of the gig create-detail step; the chain-agnostic core
 * comes from POST /v1/escrows first).
 */
export interface CreateExchangeDetailsBody {
  escrow_id: string
  /** Fiat the buyer pays for the whole offer. */
  fiat_amount: number
  /** ISO-4217, must be a SUPPORTED_CURRENCIES member. */
  fiat_currency: string
  /** Fiat per whole asset unit. */
  rate: number
  /** Defaults to EXCHANGE_PAYMENT_WINDOW_DEFAULT_SECONDS. */
  payment_window_seconds?: number
  /**
   * The caller's bank_accounts row the accepted buyer pays into. Required —
   * a sell offer with no payout target can never be settled. The server
   * asserts ownership + fiat-currency consistency.
   */
  payout_account_id: string
}

// ── Query types ───────────────────────────────────────────────────────

export interface ExchangeListQuery {
  currency?: string
  min_amount_raw?: string
  max_amount_raw?: string
  limit?: number
  offset?: number
}
