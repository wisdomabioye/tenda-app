import type { InferSelectModel } from 'drizzle-orm'
import type {
  exchange_offers,
  user_exchange_accounts,
  exchange_proofs,
  exchange_transactions,
  exchange_disputes,
} from '../db/schema'
import type { PublicUser } from './user'
import type { Review } from './review'

// ── Base types ─────────────────────────────────────────────────────────────────

export type ExchangeOffer         = InferSelectModel<typeof exchange_offers>
export type UserExchangeAccount   = InferSelectModel<typeof user_exchange_accounts>
export type ExchangeProof         = InferSelectModel<typeof exchange_proofs>
export type ExchangeTransaction   = InferSelectModel<typeof exchange_transactions>
export type ExchangeDispute       = InferSelectModel<typeof exchange_disputes>

// ── Enums ──────────────────────────────────────────────────────────────────────

export type ExchangeOfferStatus =
  | 'draft' | 'open' | 'accepted' | 'paid' | 'completed'
  | 'disputed' | 'resolved' | 'cancelled' | 'expired'

export type ExchangeTransactionType =
  | 'create_escrow' | 'accept' | 'release_payment'
  | 'cancel_refund' | 'expired_refund' | 'dispute_raised' | 'dispute_resolved'

export type ExchangeDisputeWinner = 'seller' | 'buyer' | 'split'

// ── Status transitions ─────────────────────────────────────────────────────────

export const EXCHANGE_STATUS_TRANSITIONS: Record<ExchangeOfferStatus, ExchangeOfferStatus[]> = {
  draft:     ['open', 'cancelled'],
  open:      ['accepted', 'cancelled', 'expired'],
  accepted:  ['paid', 'disputed', 'expired'],
  paid:      ['completed', 'disputed'],
  completed: [],
  disputed:  ['resolved'],
  resolved:  [],
  cancelled: [],
  expired:   [],
}

export function canExchangeTransition(from: ExchangeOfferStatus, to: ExchangeOfferStatus): boolean {
  return EXCHANGE_STATUS_TRANSITIONS[from].includes(to)
}

// ── Detail type (full offer with relations) ────────────────────────────────────

export interface ExchangeOfferDetail extends ExchangeOffer {
  seller: Pick<PublicUser, 'id' | 'first_name' | 'last_name' | 'avatar_url' | 'reputation_score' | 'is_seeker'>
  buyer:  Pick<PublicUser, 'id' | 'first_name' | 'last_name' | 'avatar_url' | 'reputation_score' | 'is_seeker'> | null
  // Payment accounts revealed only if: viewer is buyer and status != 'open', or viewer is seller
  payment_accounts: UserExchangeAccount[]
  proofs:   ExchangeProof[]
  dispute:  ExchangeDispute | null
  reviews:  Review[]
}

// ── Summary (used in order book list) ─────────────────────────────────────────

export interface ExchangeOfferSummary extends Pick<ExchangeOffer,
  'id' | 'lamports_amount' | 'fiat_amount' | 'fiat_currency' | 'rate' |
  'status' | 'accept_deadline' | 'payment_window_seconds' | 'created_at'
> {
  seller: Pick<PublicUser, 'id' | 'first_name' | 'last_name' | 'avatar_url' | 'reputation_score'>
  // method names only (no account details) visible before accepting
  payment_methods: string[]
}

// ── Input types ────────────────────────────────────────────────────────────────

export interface CreateUserExchangeAccountInput {
  method:           string
  account_name:     string
  account_number:   string
  bank_name?:       string
  additional_info?: string
}

export interface CreateExchangeOfferInput {
  lamports_amount:        bigint | number   // SOL in lamports
  fiat_amount:            number            // major currency units
  fiat_currency:          string            // ISO 4217 e.g. "NGN"
  rate:                   number            // fiat per SOL (informational)
  payment_window_seconds?: number           // default 86400 (24h)
  accept_deadline?:       string            // ISO 8601, optional
  account_ids:            string[]          // user_exchange_accounts IDs to attach
}

export interface ExchangeAcceptInput {
  signature: string  // on-chain accept_gig tx signature (buyer signs)
}

export interface ExchangePaidInput {
  proofs:    Array<{ url: string; type: 'image' | 'video' | 'document' }>
  signature: string  // on-chain submit_proof tx signature (buyer signs)
}

export interface ExchangeConfirmInput {
  signature: string  // on-chain approve_completion tx signature (seller signs)
}

export interface ExchangeDisputeInput {
  reason:    string
  signature: string  // on-chain dispute_gig tx signature
}

export interface ExchangeResolveInput {
  winner:      ExchangeDisputeWinner
  signature:   string  // on-chain resolve_dispute tx signature
  admin_note?: string
}

export interface ExchangePublishInput {
  signature: string  // on-chain create_gig_escrow tx signature (seller signs)
}

export interface ExchangeCancelInput {
  signature?: string  // on-chain cancel_gig tx (required if status was 'accepted')
}

export interface ExchangeRefundInput {
  signature: string  // on-chain refund_expired tx signature (seller signs)
}

export interface ExchangeAddProofsInput {
  proofs: Array<{ url: string; type: 'image' | 'video' | 'document' }>
}

// All create fields become optional for patch — only draft offers can be updated
export type UpdateExchangeOfferInput = Partial<CreateExchangeOfferInput>

export interface ExchangeListQuery {
  currency?:     string
  min_lamports?: number
  max_lamports?: number
  limit?:        number
  offset?:       number
}

export interface UserExchangeOffersQuery {
  limit?:  number
  offset?: number
}

// ── Blockchain request/response types ─────────────────────────────────────────

export interface ExchangeEscrowRequest {
  offer_id: string
}

export interface ExchangeAcceptRequest {
  offer_id: string
}

export interface ExchangeSubmitProofRequest {
  offer_id: string
}

export interface ExchangeConfirmRequest {
  offer_id: string
}

export interface ExchangeCancelRequest {
  offer_id: string
}

export interface ExchangeDisputeRequest {
  offer_id: string
  reason:   string
}

export interface ExchangeRefundRequest {
  offer_id: string
}
