import type { Endpoint } from '../endpoint'
import type { SupportedCurrency } from '../../constants'

export interface PlatformConfig {
  fee_bps: number
  seeker_fee_bps: number
  /** Poster review window after a worker submits proof, in seconds. */
  grace_period_seconds: number
}

export interface ExchangeRates {
  rates: Partial<Record<SupportedCurrency, number>>
  fetched_at: number
}

/** Enabled chain + its enabled assets (CO5 chain/asset picker source). */
export interface ChainRegistryEntry {
  id: string
  namespace: 'solana' | 'eip155'
  display_name: string
  assets: Array<{
    id: string
    symbol: string
    decimals: number
    is_stable: boolean
  }>
}

export interface PlatformContract {
  config:        Endpoint<'GET', undefined, undefined, undefined, PlatformConfig>
  exchangeRates: Endpoint<'GET', undefined, undefined, undefined, ExchangeRates>
  chains:        Endpoint<'GET', undefined, undefined, undefined, { data: ChainRegistryEntry[] }>
}
