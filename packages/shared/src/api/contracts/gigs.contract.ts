/**
 * Gig browse surface — read-only. Gigs are escrows (kind='gig'); creation
 * and transitions live in escrows.contract. These endpoints serve the
 * public feed from escrows ⨝ gig_details.
 */
import type { Endpoint } from '../endpoint'
import type { GigSummary, GigDetail, GigListQuery, PaginatedResponse } from '../../types'

export interface GigsContract {
  list: Endpoint<'GET', undefined, undefined, GigListQuery, PaginatedResponse<GigSummary>>
  get: Endpoint<'GET', { id: string }, undefined, undefined, GigDetail>
}
