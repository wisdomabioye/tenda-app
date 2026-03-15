import { create } from 'zustand'
import { api } from '@/api/client'
import type { ExchangeOfferSummary, ExchangeListQuery } from '@tenda/shared'

interface ExchangeState {
  offers:        ExchangeOfferSummary[]
  total:         number
  filters:       ExchangeListQuery
  isLoading:     boolean
  isLoadingMore: boolean
  hasFetched:    boolean
  error:         string | null

  fetchOffers:  () => Promise<void>
  loadMore:     () => Promise<void>
  setFilters:   (partial: Partial<ExchangeListQuery>) => void
  resetFilters: () => void
  clear:        () => void
}

const DEFAULT_FILTERS: ExchangeListQuery = { limit: 30, offset: 0 }

// Monotonically-increasing counter used to discard results from superseded requests.
let fetchGeneration = 0

export const usePeerExchangeStore = create<ExchangeState>((set, get) => ({
  offers:        [],
  total:         0,
  filters:       DEFAULT_FILTERS,
  isLoading:     false,
  isLoadingMore: false,
  hasFetched:    false,
  error:         null,

  fetchOffers: async () => {
    const gen = ++fetchGeneration
    set({ isLoading: true, error: null })
    try {
      const result = await api.exchange.list({ ...get().filters, offset: 0 })
      if (gen !== fetchGeneration) return // superseded by a newer request
      set({ offers: result.data, total: result.total, hasFetched: true })
    } catch (e: unknown) {
      if (gen !== fetchGeneration) return
      set({ error: e instanceof Error ? e.message : 'Failed to load offers' })
    } finally {
      if (gen === fetchGeneration) set({ isLoading: false })
    }
  },

  loadMore: async () => {
    const { offers, total, filters, isLoading, isLoadingMore } = get()
    if (isLoading || isLoadingMore || offers.length >= total) return
    set({ isLoadingMore: true })
    try {
      const result = await api.exchange.list({ ...filters, offset: offers.length })
      set((s) => ({ offers: [...s.offers, ...result.data], total: result.total }))
    } catch {
      // Non-fatal — user can scroll up and back to trigger another attempt
    } finally {
      set({ isLoadingMore: false })
    }
  },

  setFilters: (partial) => {
    set((s) => ({ filters: { ...s.filters, ...partial, offset: 0 } }))
    get().fetchOffers()
  },

  resetFilters: () => {
    set({ filters: DEFAULT_FILTERS })
    get().fetchOffers()
  },

  clear: () => set({
    offers: [], total: 0,
    filters: DEFAULT_FILTERS, isLoading: false, isLoadingMore: false, hasFetched: false, error: null,
  }),
}))
