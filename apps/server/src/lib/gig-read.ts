/**
 * Shared projections for the gig read surface (cutover §3): one column
 * map + one serializer so /v1/gigs, /v1/gigs/:id and any admin search
 * return byte-identical summary shapes.
 */
import { escrows, gig_details } from '@tenda/shared/db/schema'
import type { GigCategory, GigSummary, UserRef } from '@tenda/shared'
import { USER_COLS } from '@server/lib/users'

/** escrows ⨝ gig_details ⨝ users, matches the shared GigSummary wire type. */
export const GIG_SUMMARY_COLS = {
  escrow_id: escrows.id,
  chain_id: escrows.chain_id,
  asset: escrows.asset,
  amount_raw: escrows.amount_raw,
  status: escrows.status,
  accept_deadline: escrows.accept_deadline,
  created_at: escrows.created_at,
  title: gig_details.title,
  description: gig_details.description,
  category: gig_details.category,
  country: gig_details.country,
  city: gig_details.city,
  latitude: gig_details.latitude,
  longitude: gig_details.longitude,
  remote: gig_details.remote,
  cross_border: gig_details.cross_border,
  proof_requirements: gig_details.proof_requirements,
  requires_approval: escrows.requires_approval,
  creator: USER_COLS,
}

/** Drizzle row (Date columns) → wire shape (ISO strings). */
export type GigSummaryRow = Omit<
  GigSummary,
  'accept_deadline' | 'created_at' | 'category' | 'creator'
> & {
  accept_deadline: Date | null
  created_at: Date
  category: string
  creator: UserRef
}

export function toGigSummary(row: GigSummaryRow): GigSummary {
  return {
    ...row,
    // Route-level validation pins inserts to GIG_CATEGORIES; the column
    // itself is plain text (cutover §11 decision a).
    category: row.category as GigCategory,
    accept_deadline: row.accept_deadline === null ? null : row.accept_deadline.toISOString(),
    created_at: row.created_at.toISOString(),
  }
}
