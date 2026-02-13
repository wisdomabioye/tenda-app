import { create } from 'zustand'
import type { Gig, GigDetail, GigListQuery } from '@tenda/shared'
import { api } from '@/api/client'

interface GigsState {
  gigs: Gig[]
  selectedGig: GigDetail | null
  total: number
  filters: GigListQuery
  isLoading: boolean
  error: string | null

  fetchGigs: () => Promise<void>
  fetchGigDetail: (id: string) => Promise<void>
  setFilters: (filters: Partial<GigListQuery>) => void
  resetFilters: () => void
}

const defaultFilters: GigListQuery = {}

export const useGigsStore = create<GigsState>((set, get) => ({
  gigs: [],
  selectedGig: null,
  total: 0,
  filters: defaultFilters,
  isLoading: false,
  error: null,

  fetchGigs: async () => {
    set({ isLoading: true, error: null })
    try {
      const { data, total } = await api.gigs.list(get().filters)
      set({ gigs: data, total, isLoading: false })
    } catch (e) {
      set({ error: (e as Error).message, isLoading: false })
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
}))
