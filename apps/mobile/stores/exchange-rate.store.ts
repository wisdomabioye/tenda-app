import { create } from 'zustand'
import * as SecureStore from 'expo-secure-store'
import { SUPPORTED_CURRENCIES, CURRENCY_META, type SupportedCurrency } from '@tenda/shared'

const STORAGE_KEY = 'exchange_rates'
const CACHE_TTL_MS = 5 * 60 * 1000

type RateMap = Record<SupportedCurrency, number>

interface ExchangeRateState {
  /** null until rates are loaded from cache or network */
  rates: RateMap | null
  isLoading: boolean
  lastFetched: number | null
  /** Load persisted rates from SecureStore (fast, call on app start) */
  loadPersistedRates: () => Promise<void>
  /** Fetch fresh rates from CoinGecko and persist to SecureStore */
  fetchRates: () => Promise<void>
}

export const useExchangeRateStore = create<ExchangeRateState>((set, get) => ({
  rates: null,
  isLoading: false,
  lastFetched: null,

  loadPersistedRates: async () => {
    try {
      const raw = await SecureStore.getItemAsync(STORAGE_KEY)
      if (!raw) return
      const persisted = JSON.parse(raw) as { rates: RateMap; fetchedAt: number }
      set({ rates: persisted.rates, lastFetched: persisted.fetchedAt })
    } catch {
      // Ignore corrupt cache
    }
  },

  fetchRates: async () => {
    const { lastFetched, isLoading } = get()
    if (isLoading) return
    if (lastFetched && Date.now() - lastFetched < CACHE_TTL_MS) return

    set({ isLoading: true })
    try {
      const vs = SUPPORTED_CURRENCIES.map((c) => CURRENCY_META[c].coingeckoKey).join(',')
      const response = await fetch(
        `https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=${vs}`,
      )
      if (!response.ok) throw new Error('Rate fetch failed')

      const data = await response.json() as { solana: Record<string, number> }
      const solana = data.solana

      // Build a full rate map — only include currencies where API returned a value
      const existing = get().rates
      const rates = { ...existing } as RateMap
      for (const currency of SUPPORTED_CURRENCIES) {
        const key = CURRENCY_META[currency].coingeckoKey
        if (typeof solana[key] === 'number' && solana[key] > 0) {
          rates[currency] = solana[key]
        }
      }

      const fetchedAt = Date.now()
      set({ rates, lastFetched: fetchedAt, isLoading: false })

      await SecureStore.setItemAsync(STORAGE_KEY, JSON.stringify({ rates, fetchedAt }))
    } catch {
      // Keep previous values — never crash on rate fetch failure
      set({ isLoading: false })
    }
  },
}))
