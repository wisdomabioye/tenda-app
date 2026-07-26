/**
 * Gig READ surface (post-cutover). Gigs are escrows with kind='gig' —
 * creation and every transition go through /v1/escrows (escrows.contract).
 * This file only types the public browse surface: /v1/gigs (listing) and
 * /v1/gigs/:id (detail), both served from escrows ⨝ gig_details.
 */
import type { GigCategory } from '../constants/categories'
import type { ProofType } from '../constants/proofs'
import type { Dispute, EscrowProof, EscrowStatus } from './escrow'
import type { Review } from './review'
import type { UserRef } from './user'

export type { GigCategory }

// ── Wire projections ──────────────────────────────────────────────────

/** Listing item: escrows ⨝ gig_details, timestamps as ISO strings. */
export interface GigSummary {
  /** The escrow id — also the path param for /v1/escrows/:id/* actions. */
  escrow_id: string
  chain_id: string
  asset: string
  amount_raw: string
  status: EscrowStatus
  accept_deadline: string | null
  created_at: string | null
  title: string
  description: string | null
  category: GigCategory
  country: string | null
  city: string | null
  latitude: number | null
  longitude: number | null
  remote: boolean
  cross_border: boolean
  /**
   * Proof types the worker must attach before submitting. Carried on the
   * SUMMARY, not just the detail: a worker has to see the requirement before
   * they accept, or discovering it afterwards is a bait-and-switch.
   */
  proof_requirements: ProofType[]
  creator: UserRef
}

export interface GigDetail extends GigSummary {
  completion_duration_seconds: number | null
  completion_deadline: string | null
  submitted_at: string | null
  approval_deadline: string | null
  dispute_bond_raw: string
  assigned_counterparty_id: string | null
  counterparty: UserRef | null
  proofs: EscrowProof[]
  dispute: Dispute | null
  reviews: Review[]
  /**
   * Fee tier baked into the escrow at create (from the poster's seeker status).
   * Drives the worker's net-payout display — the contract charges
   * seeker_fee_bps vs fee_bps off this flag.
   */
  is_seeker: boolean
}

// ── Input types ───────────────────────────────────────────────────────

/**
 * Body of POST /v1/gigs — attaches the listing satellite to a draft
 * escrow created via POST /v1/escrows.
 */
export interface CreateGigDetailsBody {
  escrow_id: string
  title: string
  description?: string | null
  category: GigCategory
  /** Omitted for remote gigs (they carry no location); required for physical gigs. */
  country?: string
  remote?: boolean
  city?: string
  latitude?: number
  longitude?: number
  /**
   * Optional. Omitted or empty means the gig accepts any evidence, which is
   * how every gig behaved before this field existed.
   */
  proof_requirements?: ProofType[]
}

// ── Query types ───────────────────────────────────────────────────────

export interface GigListQuery {
  // status intentionally omitted — public feed is always 'open'
  country?: string
  remote?: boolean
  cross_border?: boolean
  city?: string
  category?: GigCategory
  /**
   * CAIP-2 settlement chain (`escrows.chain_id`), e.g. `solana:devnet`.
   * Validated against the RUNNING chain registry server-side — an unknown
   * (or well-formed but unregistered) id is a 400, never a silent empty page.
   */
  chain_id?: string
  /** S5.3 full-text search over title + description. */
  q?: string
  /**
   * Own listings (auth required): 'created' = I posted, 'working' = I'm
   * the (assigned) counterparty. Returns ALL statuses incl. drafts.
   */
  mine?: 'created' | 'working'
  /**
   * Narrow own listings to these statuses. ONLY valid alongside `mine=` —
   * the public feed is always 'open', so accepting it there would let a
   * caller probe for non-public rows. Serialises as CSV.
   *
   * Pair with `limit: 1` to read a status-bucketed COUNT off `total`, which
   * is how the profile screen gets its stats without pulling a capped page
   * and counting it client-side (open_issues MB2).
   */
  status?: EscrowStatus[]
  min_amount_raw?: string
  max_amount_raw?: string
  sort?: 'created_at' | 'amount_asc' | 'amount_desc'
  lat?: number // proximity search centre
  lng?: number
  radius_km?: number
  limit?: number
  offset?: number
}

// ── Helpers (safe for frontend + backend) ─────────────────────────────

/** Whether a worker can still accept this gig. */
export function isGigAcceptable(
  gig: Pick<GigSummary, 'status' | 'accept_deadline'>,
  now: Date = new Date(),
): boolean {
  if (gig.status !== 'open') return false
  if (gig.accept_deadline !== null && now > new Date(gig.accept_deadline)) return false
  return true
}

/**
 * Compute the completion deadline from accepted_at + duration.
 * Mirrors the server's lib/escrow.ts math for display purposes.
 */
export function computeCompletionDeadline(
  accepted_at: Date,
  completion_duration_seconds: number,
): Date {
  return new Date(accepted_at.getTime() + completion_duration_seconds * 1_000)
}
