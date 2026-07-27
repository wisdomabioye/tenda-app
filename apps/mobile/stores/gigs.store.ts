/**
 * Gig DETAIL store, DISPLAY ONLY post-#34. Detail comes from the read
 * surface (/v1/gigs/:id over escrows ⨝ gig_details); every lifecycle
 * transition goes through the escrow store + wallet dispatch
 * (signSendAndReport). The one off-chain action kept here is the
 * post-completion review.
 *
 * The browse LIST is deliberately not here: it is paginated, filter-scoped
 * and screen-local, so it lives in `usePaginatedList` via `useHomeFeed`.
 * Holding a single global page of gigs was what let a background poll
 * collapse the user's scrolled pages.
 */
import { create } from 'zustand'
import type { GigDetail, ReviewInput } from '@tenda/shared'
import { api } from '@/api/client'

interface GigsState {
  selectedGig: GigDetail | null
  isLoading: boolean
  error: string | null
  /**
   * The gig id `error` describes.
   *
   * `error` alone cannot say WHICH gig failed, and this store holds one slot
   * for all of them — so after any failure, opening a different gig would show
   * "Failed to load gig" for the frame before its own fetch starts. Readers
   * compare this against the id they are displaying.
   */
  errorId: string | null

  fetchGigDetail: (id: string) => Promise<void>
  reviewEscrow: (id: string, input: ReviewInput) => Promise<void>
}

export const useGigsStore = create<GigsState>((set) => ({
  selectedGig: null,
  isLoading: false,
  error: null,
  errorId: null,

  fetchGigDetail: async (id) => {
    set((state) => ({
      isLoading: true,
      error: null,
      errorId: null,
      // Drop a gig that is not the one being loaded. Holding it while a
      // different id is in flight is what let a screen render the previous
      // gig — and, since approval mode, the previous VIEWER's actions.
      selectedGig: state.selectedGig?.escrow_id === id ? state.selectedGig : null,
    }))
    try {
      const gig = await api.gigs.get({ id })
      set({ selectedGig: gig, isLoading: false })
    } catch (e) {
      set({ error: (e as Error).message, errorId: id, isLoading: false })
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
