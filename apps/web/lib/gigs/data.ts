import { cache } from 'react'
import { ApiClientError, type GigDetail, type GigListQuery, type GigSummary, type PaginatedResponse } from '@tenda/shared'
import { api } from '@/api/client'

/**
 * Server-side data seam for the public gig surfaces. Both calls are ANONYMOUS
 * by construction — they run inside server components, where the storage shim
 * returns null and no bearer is ever attached, so party-scoped fields arrive
 * withheld and nothing private can reach crawler-visible HTML.
 *
 * Caching decision (stage-1 doc asks for it to be stated): none. Every request
 * re-fetches — gig state moves and a takedown must 404 immediately, never be
 * served from a stale page. Revisit with `use cache` + a short cacheLife only
 * if feed traffic ever makes this the bottleneck.
 */
export function listGigs(query: GigListQuery): Promise<PaginatedResponse<GigSummary>> {
  return api.gigs.list(query)
}

/**
 * Wrapped in React cache() so generateMetadata and the page body share ONE
 * fetch per request (the OG tags must come from the same read that renders
 * the body). Plain fetch memoization is not relied on: api/request attaches a
 * fresh AbortSignal per call, which can opt a request out of it.
 *
 * Returns null on 404 — the route maps that to notFound(). A hidden gig is
 * already a 404 for anonymous readers server-side.
 */
export const getGig = cache(async (id: string): Promise<GigDetail | null> => {
  try {
    return await api.gigs.get({ id })
  } catch (error) {
    if (error instanceof ApiClientError && error.statusCode === 404) return null
    throw error
  }
})

/** A chain the RUNNING deployment actually serves, as the filter offers it. */
export interface GigChainOption {
  id: string
  label: string
}

/**
 * Chains for the feed's filter — from GET /v1/platform/chains (the running
 * registry), NOT the static CHAIN_MANIFEST. The server 400s a chain_id it
 * does not serve (lib/chain-filter.ts), so offering a manifest chain that is
 * not provisioned here (solana:mainnet on a devnet deployment) would turn a
 * filter click into an error page. Empty on failure — the filter hides
 * rather than offering options that might 400.
 */
export const listEnabledChains = cache(async (): Promise<GigChainOption[]> => {
  try {
    const { data } = await api.platform.chains()
    return data.map((chain) => ({ id: chain.id, label: chain.display_name }))
  } catch {
    return []
  }
})
