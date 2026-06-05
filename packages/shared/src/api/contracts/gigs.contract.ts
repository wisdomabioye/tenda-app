/**
 * Gig browse surface — read-only. Gigs are escrows (kind='gig'); creation
 * and transitions live in escrows.contract. These endpoints serve the
 * public feed from escrows ⨝ gig_details.
 */
import type { Endpoint } from '../endpoint'
import type {
  CreateGigDetailsBody,
  GigDetailsRow,
  GigSummary,
  GigDetail,
  GigListQuery,
  PaginatedResponse,
} from '../../types'

export interface GigsContract {
  list: Endpoint<'GET', undefined, undefined, GigListQuery, PaginatedResponse<GigSummary>>
  /** CO8 curated rail — home-top carousel; separately cached server-side. */
  featured: Endpoint<'GET', undefined, undefined, undefined, { data: GigSummary[] }>
  /** Attach the listing satellite to a draft escrow (create flow step 2). */
  create: Endpoint<'POST', undefined, CreateGigDetailsBody, undefined, GigDetailsRow>
  get: Endpoint<'GET', { id: string }, undefined, undefined, GigDetail>
}
