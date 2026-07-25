/**
 * My-Gigs controller: the caller's Posted and Working listings, each
 * independently paginated, plus the shared chain filter.
 *
 * BOTH lists load on mount rather than only the active tab. That is what
 * fixes the inactive tab's count chip reading 0 until it was swiped to
 * (open_issues MB2) — the chips now read the server `total` for a list that
 * has actually been fetched, instead of the length of an array nobody
 * populated. `total` also stays correct once the list pages, where
 * `items.length` would mean "loaded so far".
 */
import { useState } from 'react'
import type { GigListQuery, GigSummary } from '@tenda/shared'
import { api } from '@/api/client'
import { usePaginatedList, type PaginatedListState } from '@/hooks/usePaginatedList'
import { useAuthStore } from '@/stores/auth.store'

export interface MyGigsState {
  posted: PaginatedListState<GigSummary>
  working: PaginatedListState<GigSummary>
  chainId: string | null
  setChainId: (chain_id: string | null) => void
}

const keyOf = (gig: GigSummary) => gig.escrow_id

export function useMyGigs(): MyGigsState {
  const user = useAuthStore((s) => s.user)
  const [chainId, setChainId] = useState<string | null>(null)

  // `mine=` resolves identity from the JWT, but gating on the loaded user
  // keeps the request from firing before sign-in state settles.
  const enabled = user?.id !== undefined

  const posted = usePaginatedList<GigSummary, GigListQuery>({
    fetchPage: (params) => api.gigs.list(params),
    query: { mine: 'created', chain_id: chainId ?? undefined },
    keyOf,
    enabled,
  })

  const working = usePaginatedList<GigSummary, GigListQuery>({
    fetchPage: (params) => api.gigs.list(params),
    query: { mine: 'working', chain_id: chainId ?? undefined },
    keyOf,
    enabled,
  })

  // `setChainId` is React's own setter — already stable, so it is returned
  // directly rather than re-wrapped (matching useExchangeScreen).
  return { posted, working, chainId, setChainId }
}
