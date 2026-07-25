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

  fetchGigDetail: (id: string) => Promise<void>
  reviewEscrow: (id: string, input: ReviewInput) => Promise<void>
}

export const useGigsStore = create<GigsState>((set) => ({
  selectedGig: null,
  isLoading: false,
  error: null,

  fetchGigDetail: async (id) => {
    set({ isLoading: true, error: null })
    try {
      const gig = await api.gigs.get({ id })
      set({ selectedGig: gig, isLoading: false })
    } catch (e) {
      set({ error: (e as Error).message, isLoading: false })
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
