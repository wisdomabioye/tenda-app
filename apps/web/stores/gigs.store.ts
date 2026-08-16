/**
 * Gig DETAIL store — verbatim port of apps/mobile/stores/gigs.store.ts.
 * DISPLAY ONLY post-#34: detail comes from /v1/gigs/:id; every lifecycle
 * transition goes through the escrow store + wallet dispatch. The one
 * off-chain action kept here is the post-completion review.
 */
import { create } from 'zustand'
import type { GigDetail, ReviewInput } from '@tenda/shared'
import { api } from '@/api/client'
import { classifyDetailLoadError, type DetailLoadError } from '@tenda/shared'

/**
 * A failed load, and WHICH gig it was for. The id is carried inside the
 * error: this store holds one slot for every gig, so a bare message cannot
 * say what failed.
 */
export interface GigLoadError extends DetailLoadError {
  id: string
}

interface GigsState {
  selectedGig: GigDetail | null
  isLoading: boolean
  error: GigLoadError | null

  fetchGigDetail: (id: string) => Promise<void>
  reviewEscrow: (id: string, input: ReviewInput) => Promise<void>
}

/**
 * Which fetch is allowed to write. Bumped on every call; a response whose
 * token is no longer the latest is DISCARDED, success or failure alike — one
 * slot serves every gig, so a late response is about a different subject.
 */
let latestRequest = 0

export const useGigsStore = create<GigsState>((set) => ({
  selectedGig: null,
  isLoading: false,
  error: null,

  fetchGigDetail: async (id) => {
    const request = ++latestRequest
    set((state) => ({
      isLoading: true,
      error: null,
      // Drop a gig that is not the one being loaded — holding it while a
      // different id is in flight is what let a screen render the previous
      // gig (and, since approval mode, the previous VIEWER's actions).
      selectedGig: state.selectedGig?.escrow_id === id ? state.selectedGig : null,
    }))
    try {
      const gig = await api.gigs.get({ id })
      if (request !== latestRequest) return
      set({ selectedGig: gig, isLoading: false })
    } catch (e) {
      if (request !== latestRequest) return
      const failure = classifyDetailLoadError(e)
      // A `gone` refetch DROPS the gig it was refreshing — a gig deleted or
      // taken down mid-session must not keep rendering with live buttons. A
      // transient failure deliberately does NOT drop it.
      set((state) => ({
        error: { id, ...failure },
        isLoading: false,
        selectedGig:
          failure.gone && state.selectedGig?.escrow_id === id ? null : state.selectedGig,
      }))
    }
  },

  reviewEscrow: async (id, input) => {
    set({ isLoading: true })
    try {
      await api.escrows.review({ id }, input)
      set({ isLoading: false })
    } catch (e) {
      set({ isLoading: false })
      throw e
    }
  },
}))
