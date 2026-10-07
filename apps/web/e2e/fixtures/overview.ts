/** Authenticated dashboard/profile counts, consistent with the review fixture. */
import type { MyOverviewResponse } from '@tenda/shared'
import { REVIEW_COUNT } from './reviews'
import { errorEnvelope, json, type StubResponse } from './reply'

export function handleOverview(url: URL, method: string, authorized: boolean): StubResponse | null {
  if (url.pathname !== '/v1/users/me/overview' || method !== 'GET') return null
  if (!authorized) {
    return errorEnvelope(401, 'Unauthorized', 'Invalid or missing token', 'UNAUTHORIZED')
  }
  // Fixed figures: the stub models no ownership. Specs needing a particular
  // count intercept this endpoint themselves.
  const overview: MyOverviewResponse = {
    stats: { posted: 1, active: 1, completed: 1, reviews: REVIEW_COUNT },
    open_disputes: 0,
  }
  return json(overview)
}
