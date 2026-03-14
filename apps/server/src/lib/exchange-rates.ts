import { SUPPORTED_CURRENCIES, CURRENCY_META, type SupportedCurrency } from '@tenda/shared'
import { AppError } from '@server/lib/errors'

export interface CachedExchangeRates {
  rates: Partial<Record<SupportedCurrency, number>>
  fetched_at: number
}

let _cache: CachedExchangeRates | null = null
let _cacheExpiry = 0
const CACHE_TTL_MS = 5 * 60 * 1000 // 5 minutes

/**
 * Fetch SOL exchange rates from CoinGecko, cached for 5 minutes.
 * On CoinGecko failure, returns stale cache if available rather than erroring.
 * Throws 503 only when there is no cached data to fall back on.
 */
export async function getExchangeRates(): Promise<CachedExchangeRates> {
  const now = Date.now()
  if (_cache && now < _cacheExpiry) return _cache

  const vs = SUPPORTED_CURRENCIES.map((c) => CURRENCY_META[c].coingeckoKey).join(',')

  let response: Response
  try {
    response = await fetch(
      `https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=${vs}`,
      { signal: AbortSignal.timeout(10_000) },
    )
  } catch {
    if (_cache) return _cache
    throw new AppError(503, 'EXCHANGE_RATE_UNAVAILABLE', 'Exchange rate service is currently unavailable')
  }

  if (!response.ok) {
    if (_cache) return _cache
    throw new AppError(503, 'EXCHANGE_RATE_UNAVAILABLE', 'Exchange rate service is currently unavailable')
  }

  const data = await response.json() as { solana: Record<string, number> }
  const solana = data.solana

  const rates: Partial<Record<SupportedCurrency, number>> = {}
  for (const currency of SUPPORTED_CURRENCIES) {
    const key = CURRENCY_META[currency].coingeckoKey
    if (typeof solana[key] === 'number' && solana[key] > 0) {
      rates[currency] = solana[key]
    }
  }

  _cache = { rates, fetched_at: now }
  _cacheExpiry = now + CACHE_TTL_MS
  return _cache
}
