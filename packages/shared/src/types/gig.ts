import type { InferSelectModel, InferInsertModel } from 'drizzle-orm'
import type { gigs, disputes, gig_proofs, gig_transactions } from '../db/schema'
import type { GigCategory } from '../constants/categories'

export type { GigCategory }

// ── Base types inferred from schema ───────────────────────────────────

export type Gig            = InferSelectModel<typeof gigs>
export type NewGig         = InferInsertModel<typeof gigs>
export type Dispute        = InferSelectModel<typeof disputes>
export type NewDispute     = InferInsertModel<typeof disputes>
export type GigProof       = InferSelectModel<typeof gig_proofs>
export type NewGigProof    = InferInsertModel<typeof gig_proofs>
export type GigTransaction = InferSelectModel<typeof gig_transactions>

// ── Enums ─────────────────────────────────────────────────────────────

export type GigStatus =
  | 'draft'
  | 'open'
  | 'accepted'
  | 'submitted'
  | 'completed'
  | 'disputed'
  | 'resolved'
  | 'expired'
  | 'cancelled'

export type DisputeWinner = 'worker' | 'poster' | 'split'

export type GigTransactionType =
  | 'create_escrow'
  | 'release_payment'
  | 'cancel_refund'
  | 'expired_refund'
  | 'dispute_resolved'

// ── Status transitions ────────────────────────────────────────────────

export const GIG_STATUS_TRANSITIONS: Record<GigStatus, GigStatus[]> = {
  draft:     ['open', 'cancelled'],
  open:      ['accepted', 'expired', 'cancelled'],
  accepted:  ['submitted', 'disputed', 'expired'],
  submitted: ['completed', 'disputed'],
  completed: [],
  disputed:  ['resolved'],
  resolved:  [],
  expired:   [],
  cancelled: [],
}

export function canTransition(from: GigStatus, to: GigStatus): boolean {
  return GIG_STATUS_TRANSITIONS[from].includes(to)
}

// ── Input types ───────────────────────────────────────────────────────

export interface CreateGigInput {
  title: string
  description: string
  payment_lamports: number
  category: GigCategory
  city: string
  address?: string
  latitude?: number
  longitude?: number
  completion_duration_seconds: number  // how long worker has after accepting
  accept_deadline?: string             // ISO 8601, optional — null = indefinitely open
}

export interface UpdateGigInput {
  title?: string
  description?: string
  payment_lamports?: number
  category?: GigCategory
  city?: string
  address?: string | null
  latitude?: number | null
  longitude?: number | null
  completion_duration_seconds?: number
  accept_deadline?: string | null      // null explicitly removes the cutoff
}

export interface PublishGigInput {
  signature: string  // on-chain tx signature for create_gig_escrow
  // escrow_address derived server-side: findProgramAddressSync([ESCROW_SEED, gig_id])
}

export interface CancelGigInput {
  signature?: string  // required when cancelling an open gig (escrow refund tx); omit for draft
}

export interface DisputeGigInput {
  reason: string
}

export interface ResolveDisputeInput {
  winner: DisputeWinner
  signature: string  // on-chain tx signature for resolve_dispute
  // resolver_wallet_address taken from request.user.wallet_address
}

export interface AcceptGigInput {
  signature: string  // on-chain tx signature for accept_gig
}

export interface SubmitProofInput {
  proofs: Array<{ url: string; type: 'image' | 'video' | 'document' }>
  signature: string  // on-chain tx signature for submit_proof
}

export interface ApproveGigInput {
  signature: string  // on-chain tx signature for approve_completion
  // amount_lamports derived from gig.payment_lamports
  // platform_fee_lamports derived from payment_lamports * PLATFORM_FEE_BPS / 10_000
}

export interface RefundExpiredInput {
  signature: string  // on-chain tx signature for refund_expired
}

// ── Response types ────────────────────────────────────────────────────

export interface GigDetail extends Gig {
  poster: {
    id: string
    first_name: string | null
    last_name: string | null
    avatar_url: string | null
    reputation_score: number | null
  }
  worker: {
    id: string
    first_name: string | null
    last_name: string | null
    avatar_url: string | null
    reputation_score: number | null
  } | null
  proofs: GigProof[]
  dispute: Dispute | null
}

/** A gig_transaction enriched with minimal gig context for the wallet screen. */
export interface UserTransaction {
  id: string
  gig_id: string
  type: GigTransactionType
  signature: string
  amount_lamports: number
  platform_fee_lamports: number
  created_at: string | null
  gig: {
    id: string
    title: string
    status: GigStatus
    payment_lamports: number
    poster_id: string
    worker_id: string | null
  }
}

// ── Query types ───────────────────────────────────────────────────────

export interface UserGigsQuery {
  role?: 'poster' | 'worker'
  limit?: number
  offset?: number
}

export interface GigListQuery {
  // status intentionally omitted — public feed is always 'open'
  city?: string
  category?: GigCategory
  min_payment_lamports?: number
  max_payment_lamports?: number
  sort?: 'created_at' | 'payment_asc' | 'payment_desc'
  lat?: number    // proximity search centre
  lng?: number
  radius_km?: number
  limit?: number
  offset?: number
}

// ── Helpers (safe for frontend + backend) ─────────────────────────────

/** Whether a gig is in a state that allows editing (draft only) */
export function isGigEditable(status: GigStatus): boolean {
  return status === 'draft'
}

/** Whether a worker can still accept this gig */
export function isGigAcceptable(gig: Pick<Gig, 'status' | 'accept_deadline'>): boolean {
  if (gig.status !== 'open') return false
  if (gig.accept_deadline && new Date() > new Date(gig.accept_deadline)) return false
  return true
}

/**
 * Compute the completion deadline from accepted_at + duration.
 * Not stored in DB — call this whenever you need to display or enforce it.
 */
export function computeCompletionDeadline(
  accepted_at: Date,
  completion_duration_seconds: number,
): Date {
  return new Date(accepted_at.getTime() + completion_duration_seconds * 1_000)
}
