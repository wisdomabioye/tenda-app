import { create } from 'zustand'

const DEFAULT_SOL_TO_NGN = 2_400_000 // fallback if fetch fails
const CACHE_TTL_MS = 5 * 60 * 1000  // 5 minutes

interface ExchangeRateState {
  solToNgn: number
  isLoading: boolean
  lastFetched: number | null
  fetchRate: () => Promise<void>
}

export const useExchangeRateStore = create<ExchangeRateState>((set, get) => ({
  solToNgn: DEFAULT_SOL_TO_NGN,
  isLoading: false,
  lastFetched: null,

  fetchRate: async () => {
    const { lastFetched, isLoading } = get()
    if (isLoading) return
    if (lastFetched && Date.now() - lastFetched < CACHE_TTL_MS) return

    set({ isLoading: true })
    try {
      const response = await fetch(
        'https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=ngn',
      )
      if (!response.ok) throw new Error('Rate fetch failed')
      const data = await response.json() as { solana: { ngn: number } }
      set({ solToNgn: data.solana.ngn, lastFetched: Date.now(), isLoading: false })
    } catch {
      // Keep previous value — never crash on rate fetch failure
      set({ isLoading: false })
    }
  },
}))
