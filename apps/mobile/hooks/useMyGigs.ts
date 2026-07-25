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
 *
 * Both lists also re-read page 0 on every LATER focus. My Gigs is a tab, so it
 * stays mounted for the rest of the session: without this, posting a gig,
 * accepting one, or deleting a draft left both the rows AND the count chips
 * (which read the server `total`) showing pre-action state indefinitely.
 */
import { useCallback, useRef, useState } from 'react'
import { useFocusEffect } from 'expo-router'
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

  // Mirrored into refs so the focus callback's identity never changes when a
  // list settles — that would re-fire the effect and turn the first load into
  // two, which is the double-fetch this screen was just cleaned of.
  const postedFetchedRef = useRef(false)
  postedFetchedRef.current = posted.hasFetched
  const workingFetchedRef = useRef(false)
  workingFetchedRef.current = working.hasFetched

  useFocusEffect(
    useCallback(() => {
      // Page 0 is owned by each controller's query effect (mount, gate opening,
      // chain-filter change), so only a LATER focus re-reads here. `reload` is
      // the silent, preserve-loaded-pages variant: no spinner over a list the
      // user is already looking at, and no yank back to page 0 if they scrolled.
      if (postedFetchedRef.current) void posted.reload()
      if (workingFetchedRef.current) void working.reload()
      // Both `reload`s are stable (see usePaginatedList) and the flags are read
      // through refs, so the callback deliberately has no deps — it must fire
      // on focus, not on every settled load.
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []),
  )

  // `setChainId` is React's own setter — already stable, so it is returned
  // directly rather than re-wrapped (matching useExchangeScreen).
  return { posted, working, chainId, setChainId }
}
