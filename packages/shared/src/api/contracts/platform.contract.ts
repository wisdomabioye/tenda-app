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

export interface PlatformContract {
  config:        Endpoint<'GET', undefined, undefined, undefined, PlatformConfig>
  exchangeRates: Endpoint<'GET', undefined, undefined, undefined, ExchangeRates>
}
