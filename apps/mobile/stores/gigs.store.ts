/**
 * Gig browse store, DISPLAY ONLY post-#34. Listings/detail come from the
 * read surface (/v1/gigs over escrows ⨝ gig_details); every lifecycle
 * transition goes through the escrow store + wallet dispatch
 * (signSendAndReport). The one off-chain action kept here is the
 * post-completion review.
 */
import { create } from 'zustand'
import type { GigSummary, GigDetail, GigListQuery, ReviewInput } from '@tenda/shared'
import { api } from '@/api/client'

interface GigsState {
  gigs: GigSummary[]
  selectedGig: GigDetail | null
  total: number
  filters: GigListQuery
  isLoading: boolean
  hasFetched: boolean
  error: string | null

  fetchGigs: () => Promise<void>
  fetchGigDetail: (id: string) => Promise<void>
  setFilters: (filters: Partial<GigListQuery>) => void
  resetFilters: () => void

  reviewEscrow: (id: string, input: ReviewInput) => Promise<void>
}

const defaultFilters: GigListQuery = {}

export const useGigsStore = create<GigsState>((set, get) => ({
  gigs: [],
  selectedGig: null,
  total: 0,
  filters: defaultFilters,
  isLoading: false,
  hasFetched: false,
  error: null,

  fetchGigs: async () => {
    set({ isLoading: true, error: null })
    try {
      const { data, total } = await api.gigs.list(get().filters)
      set({ gigs: data, total, isLoading: false, hasFetched: true })
    } catch (e) {
      set({ error: (e as Error).message, isLoading: false, hasFetched: true })
    }
  },

  fetchGigDetail: async (id) => {
    set({ isLoading: true, error: null })
    try {
      const gig = await api.gigs.get({ id })
      set({ selectedGig: gig, isLoading: false })
    } catch (e) {
      set({ error: (e as Error).message, isLoading: false })
    }
  },

  setFilters: (filters) => {
    set((state) => ({ filters: { ...state.filters, ...filters } }))
  },

  resetFilters: () => set({ filters: defaultFilters }),

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
