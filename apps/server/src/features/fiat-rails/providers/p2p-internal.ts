/**
 * p2p_internal provider — the always-available fallback AND the canonical
 * home of the exchange primitive (locked decision #14; stage-8 § Provider
 * routing). Quotes at the platform mid-rate plus a fixed spread; initiate
 * surfaces the intent on the P2P exchange where existing offers fulfil it.
 *
 * Settlement is driven by the exchange flow's own events, not a provider
 * webhook — the reconcile job treats matched-and-confirmed exchanges as
 * completed (see `P2pFulfilment` seam).
 *
 * STATELESS between quote and initiate: deps are rebuilt per request, so
 * initiate consumes the quote snapshot the service re-supplies from the
 * intent row instead of any in-memory cache.
 */

import { randomUUID } from 'node:crypto'
import { AppError } from '@server/lib/errors'
import { ErrorCode } from '@tenda/shared'
import { P2P_INTERNAL_ID, P2P_INTERNAL_SPREAD_BPS } from '../config'
import type {
  FiatProvider,
  ProviderCapabilities,
  ProviderQuote,
  ProviderIntentStatus,
} from '../types'

/** Mid-rate source: fiat per display unit of asset (e.g. NGN per USDC). */
export interface RateSource {
  midRate(asset: string, fiat_currency: string): Promise<number>
}

/**
 * Exchange-side fulfilment seam. `open` posts/locates an offer for the
 * intent; `status` reports how the exchange leg is doing. The drizzle
 * implementation rides the existing exchange feature tables.
 */
export interface P2pFulfilment {
  open(input: {
    user_id: string
    direction: 'onramp' | 'offramp'
    fiat_currency: string
    fiat_amount: number
    asset: string
    asset_amount_raw: string
    rate: number
  }): Promise<{ offer_id: string }>
  status(offer_id: string): Promise<ProviderIntentStatus>
}

export interface P2pInternalDeps {
  rates: RateSource
  fulfilment: P2pFulfilment
  /**
   * Declared by the fulfilment implementation: the pre-cutover drizzle
   * impl rides the legacy SOL-denominated exchange (offramp only); the
   * v2 exchange surface widens this at cutover without provider changes.
   */
  capabilities: ProviderCapabilities
  now(): Date
}

export function p2pInternalProvider(deps: P2pInternalDeps): FiatProvider {
  return {
    id: P2P_INTERNAL_ID,
    capabilities: deps.capabilities,

    async quote(req) {
      const mid = await deps.rates.midRate(req.asset, req.fiat_currency)
      if (!Number.isFinite(mid) || mid <= 0) {
        throw new AppError(503, ErrorCode.SERVICE_UNAVAILABLE, 'no exchange rate available')
      }
      // Spread protects matched counterparties from quoting at exact mid.
      const spread = P2P_INTERNAL_SPREAD_BPS / 10_000
      // Onramp: user pays fiat, receives asset → rate marked UP (fewer
      // asset units per fiat). Offramp: user receives fiat → rate DOWN.
      const rate = req.direction === 'onramp' ? mid * (1 + spread) : mid * (1 - spread)

      const scale = 10 ** req.asset_decimals
      let fiat_amount: number
      let asset_amount_raw: string
      if (req.direction === 'onramp') {
        if (req.fiat_amount === null || req.fiat_amount <= 0) {
          throw new AppError(422, ErrorCode.VALIDATION_ERROR, 'fiat_amount required for onramp quotes')
        }
        fiat_amount = req.fiat_amount
        asset_amount_raw = String(Math.floor((req.fiat_amount / rate) * scale))
      } else {
        if (req.asset_amount_raw === null) {
          throw new AppError(422, ErrorCode.VALIDATION_ERROR, 'asset_amount_raw required for offramp quotes')
        }
        const display = Number(req.asset_amount_raw) / scale
        fiat_amount = Math.floor(display * rate * 100) / 100
        asset_amount_raw = req.asset_amount_raw
      }

      const quote: ProviderQuote = {
        quote_ref: randomUUID(),
        rate,
        // No Tenda margin on conversion (stage-8 open questions: pass-through).
        fee_amount: 0,
        fiat_amount,
        asset_amount_raw,
        kyc_required: false,
        kyc_url: null,
      }
      return quote
    },

    async initiate({ user_id, direction, quote }) {
      const { offer_id } = await deps.fulfilment.open({
        user_id,
        direction,
        fiat_currency: quote.fiat_currency,
        fiat_amount: quote.fiat_amount,
        asset: quote.asset,
        asset_amount_raw: quote.asset_amount_raw,
        rate: quote.rate,
      })
      return {
        provider_ref: offer_id,
        instruction: { kind: 'p2p', offer_id },
        kyc_url: null,
      }
    },

    async status(provider_ref) {
      return deps.fulfilment.status(provider_ref)
    },
  }
}
