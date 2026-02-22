import { create } from 'zustand'
import type { Gig, GigDetail, GigListQuery, ReviewInput, SubmitProofInput, AcceptGigInput } from '@tenda/shared'
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

  acceptGig: (id: string, body: AcceptGigInput) => Promise<void>
  submitProof: (id: string, body: SubmitProofInput) => Promise<void>
  disputeGig: (id: string, reason: string) => Promise<void>
  reviewGig: (id: string, input: ReviewInput) => Promise<void>
  cancelDraftGig: (id: string) => Promise<void>
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

  acceptGig: async (id, body) => {
    set({ isLoading: true })
    try {
      await api.gigs.accept({ id }, body)
      await get().fetchGigDetail(id)
    } catch (e) {
      set({ isLoading: false })
      throw e
    }
  },

  submitProof: async (id, body) => {
    set({ isLoading: true })
    try {
      await api.gigs.submit({ id }, body)
      await get().fetchGigDetail(id)
    } catch (e) {
      set({ isLoading: false })
      throw e
    }
  },

  disputeGig: async (id, reason) => {
    set({ isLoading: true })
    try {
      const gig = await api.gigs.dispute({ id }, { reason })
      set((state) => ({
        isLoading: false,
        selectedGig: state.selectedGig ? { ...state.selectedGig, ...gig } : null,
      }))
    } catch (e) {
      set({ isLoading: false })
      throw e
    }
  },

  reviewGig: async (id, input) => {
    set({ isLoading: true })
    try {
      await api.gigs.review({ id }, input)
      set({ isLoading: false })
    } catch (e) {
      set({ isLoading: false })
      throw e
    }
  },

  cancelDraftGig: async (id) => {
    set({ isLoading: true })
    try {
      await api.gigs.delete({ id })
      set({ isLoading: false })
    } catch (e) {
      set({ isLoading: false })
      throw e
    }
  },
}))
