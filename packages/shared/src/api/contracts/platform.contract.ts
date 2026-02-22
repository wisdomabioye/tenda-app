import type { Endpoint } from '../endpoint'

export interface PlatformConfig {
  fee_bps: number
}

export interface PlatformContract {
  config: Endpoint<'GET', undefined, undefined, undefined, PlatformConfig>
}
