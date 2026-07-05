/**
 * Exchange order-book store (post-#34), read-only browse over
 * /v1/exchange (escrows kind='exchange' ⨝ exchange_details). Replaces the
 * legacy p2p-exchange store; transitions ride the escrow store + wallet
 * dispatch like every other escrow.
 */
import { create } from 'zustand'
import type { ExchangeSummary, ExchangeListQuery } from '@tenda/shared'
import { api } from '@/api/client'

const PAGE_SIZE = 20

interface ExchangeMarketState {
  offers: ExchangeSummary[]
  total: number
  filters: ExchangeListQuery
  isLoading: boolean
  isLoadingMore: boolean
  hasFetched: boolean
  error: string | null

  fetchOffers: () => Promise<void>
  loadMore: () => Promise<void>
  setFilters: (filters: Partial<ExchangeListQuery>) => void
  resetFilters: () => void
  clear: () => void
}

const defaultFilters: ExchangeListQuery = {}

export const useExchangeMarketStore = create<ExchangeMarketState>((set, get) => ({
  offers: [],
  total: 0,
  filters: defaultFilters,
  isLoading: false,
  isLoadingMore: false,
  hasFetched: false,
  error: null,

  fetchOffers: async () => {
    set({ isLoading: true, error: null })
    try {
      const { data, total } = await api.exchange.list({ ...get().filters, limit: PAGE_SIZE, offset: 0 })
      set({ offers: data, total, isLoading: false, hasFetched: true })
    } catch (e) {
      set({ error: (e as Error).message, isLoading: false, hasFetched: true })
    }
  },

  loadMore: async () => {
    const { offers, total, isLoading, isLoadingMore, filters } = get()
    if (isLoading || isLoadingMore || offers.length >= total) return
    set({ isLoadingMore: true })
    try {
      const { data, total: nextTotal } = await api.exchange.list({
        ...filters,
        limit: PAGE_SIZE,
        offset: offers.length,
      })
      set({ offers: [...offers, ...data], total: nextTotal, isLoadingMore: false })
    } catch {
      // Non-fatal, the next end-reach retries.
      set({ isLoadingMore: false })
    }
  },

  setFilters: (filters) => {
    set((state) => ({ filters: { ...state.filters, ...filters } }))
    void get().fetchOffers()
  },

  resetFilters: () => {
    set({ filters: defaultFilters })
    void get().fetchOffers()
  },

  clear: () => set({ offers: [], total: 0, filters: defaultFilters, hasFetched: false, error: null }),
}))
