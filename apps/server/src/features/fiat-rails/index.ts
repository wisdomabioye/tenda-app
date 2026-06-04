/**
 * Fiat-rails public surface (stage-8-fiat-rails.md). Routes/webhooks/jobs
 * import from HERE — never from the module internals (exit criterion:
 * single import surface).
 *
 * `buildFiatDeps(fastify)` assembles the live dependency set:
 *  - p2p_internal: always present. Pre-cutover the drizzle fulfilment
 *    rides the legacy SOL exchange (offramp only); the v2 exchange widens
 *    it at cutover by swapping the fulfilment implementation.
 *  - yellowcard / onrampmoney: present only when their env credentials
 *    exist (#61) — a missing key means the provider simply isn't offered.
 */

import type { FastifyInstance } from 'fastify'
import { eq } from 'drizzle-orm'
import { exchange_offers } from '@tenda/shared/db/schema'
import { fiat_providers } from '@tenda/shared/db/schema-v2/fiat'
import { getConfig } from '@server/config'
import { getExchangeRates } from '@server/lib/exchange-rates'
import { appEvents } from '@server/lib/events'
import type { SupportedCurrency } from '@tenda/shared'
import { AppError } from '@server/lib/errors'
import { ErrorCode } from '@tenda/shared'
import { P2P_INTERNAL_ID } from './config'
import { drizzleFiatStore } from './store'
import {
  p2pInternalProvider,
  type P2pFulfilment,
  type RateSource,
} from './providers/p2p-internal'
import { licensedHttpProvider, fetchProviderHttp } from './providers/licensed-http'
import { YELLOWCARD_SPEC, ONRAMPMONEY_SPEC } from './providers/specs'
import type { FiatDeps, FiatEventSink } from './service'
import type { FiatProvider } from './types'

export { requestQuote, initiateIntent, cancelIntent, settleFromProvider, reconcileIntent } from './service'
export type { QuoteInput, QuoteResult, InitiateOutput, FiatDeps, FiatEvent } from './service'
export { drizzleFiatStore, drizzleBankAccountStore, OPEN_STATUSES } from './store'
export type { FiatStore, BankAccountStore, BankAccountRow } from './store'
export { pickCandidates, supportsRequest } from './routing'
export type { ProviderRegistryRow } from './routing'
export * from './types'
export { QUOTE_TTL_MS, P2P_INTERNAL_ID } from './config'

// ---------- live rate source ---------------------------------------------------

/**
 * Pre-cutover: the platform rate cache is SOL-denominated (CoinGecko) —
 * exactly what the legacy P2P exchange trades. Other assets reject until
 * the v2 exchange brings its own pricing.
 */
function solRateSource(): RateSource {
  return {
    async midRate(asset, fiat_currency) {
      if (asset !== 'SOL' && asset !== 'SOL_DEVNET') {
        throw new AppError(503, ErrorCode.SERVICE_UNAVAILABLE, `no rate source for asset '${asset}'`)
      }
      const { rates } = await getExchangeRates()
      const rate = rates[fiat_currency as SupportedCurrency]
      if (rate === undefined) {
        throw new AppError(503, ErrorCode.SERVICE_UNAVAILABLE, `no rate for currency '${fiat_currency}'`)
      }
      return rate
    },
  }
}

// ---------- live P2P fulfilment ---------------------------------------------------

/**
 * Offramp via the legacy exchange: open a sell-SOL offer (draft) on the
 * user's behalf — the user publishes it from the exchange surface (signs
 * the escrow tx), buyers fulfil, and `status` maps the offer lifecycle.
 */
function drizzleP2pFulfilment(fastify: FastifyInstance): P2pFulfilment {
  return {
    async open(input) {
      if (input.direction !== 'offramp') {
        throw new AppError(503, ErrorCode.PROVIDER_UNAVAILABLE, 'p2p onramp lands with the v2 exchange')
      }
      const lamports = Number(input.asset_amount_raw)
      const [offer] = await fastify.db
        .insert(exchange_offers)
        .values({
          seller_id: input.user_id,
          lamports_amount: lamports,
          fiat_amount: Math.round(input.fiat_amount),
          fiat_currency: input.fiat_currency,
          // Legacy column semantics: fiat per SOL — the rate source already
          // quotes in display units, so this is a direct carry.
          rate: input.rate,
          status: 'draft',
        })
        .returning({ id: exchange_offers.id })
      return { offer_id: offer.id }
    },

    async status(offer_id) {
      const [offer] = await fastify.db
        .select({ status: exchange_offers.status })
        .from(exchange_offers)
        .where(eq(exchange_offers.id, offer_id))
        .limit(1)
      if (offer === undefined) return 'not_found'
      if (offer.status === 'completed' || offer.status === 'resolved') return 'completed'
      if (offer.status === 'cancelled' || offer.status === 'expired') return 'failed'
      return 'pending'
    },
  }
}

// ---------- deps builder --------------------------------------------------------

function liveEventSink(): FiatEventSink {
  return {
    settled(e) {
      appEvents.emit('fiat.settled', e)
    },
    failed(e) {
      appEvents.emit('fiat.failed', e)
    },
  }
}

export function buildProviders(fastify: FastifyInstance): Map<string, FiatProvider> {
  const cfg = getConfig()
  const providers = new Map<string, FiatProvider>()

  providers.set(
    P2P_INTERNAL_ID,
    p2pInternalProvider({
      rates: solRateSource(),
      fulfilment: drizzleP2pFulfilment(fastify),
      capabilities: {
        onramp: false,
        offramp: true,
        currencies: ['NGN'],
        assets: ['SOL', 'SOL_DEVNET'],
      },
      now: () => new Date(),
    }),
  )

  if (cfg.YELLOWCARD_API_KEY !== null && cfg.YELLOWCARD_API_SECRET !== null) {
    providers.set(
      YELLOWCARD_SPEC.id,
      licensedHttpProvider(
        YELLOWCARD_SPEC,
        { api_key: cfg.YELLOWCARD_API_KEY, api_secret: cfg.YELLOWCARD_API_SECRET },
        fetchProviderHttp(),
      ),
    )
  }
  if (cfg.ONRAMPMONEY_API_KEY !== null && cfg.ONRAMPMONEY_API_SECRET !== null) {
    providers.set(
      ONRAMPMONEY_SPEC.id,
      licensedHttpProvider(
        ONRAMPMONEY_SPEC,
        { api_key: cfg.ONRAMPMONEY_API_KEY, api_secret: cfg.ONRAMPMONEY_API_SECRET },
        fetchProviderHttp(),
      ),
    )
  }
  return providers
}

export async function buildFiatDeps(fastify: FastifyInstance): Promise<FiatDeps> {
  const registry = await fastify.db
    .select({
      id: fiat_providers.id,
      priority: fiat_providers.priority,
      is_enabled: fiat_providers.is_enabled,
    })
    .from(fiat_providers)

  return {
    store: drizzleFiatStore(fastify.db),
    providers: buildProviders(fastify),
    registry,
    events: liveEventSink(),
    now: () => new Date(),
    log: fastify.log,
  }
}
