/**
 * Fiat-rails public surface (stage-8-fiat-rails.md). Routes/webhooks/jobs
 * import from HERE — never from the module internals (exit criterion:
 * single import surface).
 *
 * `buildFiatDeps(fastify)` assembles the live dependency set:
 *  - p2p_internal: always present. The drizzle fulfilment opens v2
 *    exchange escrows (kind='exchange'; offramp only — onramp lands when
 *    the buy side of the order book ships).
 *  - yellowcard / onrampmoney: present only when their env credentials
 *    exist (#61) — a missing key means the provider simply isn't offered.
 */

import type { FastifyInstance } from 'fastify'
import { eq } from 'drizzle-orm'
import { assets, escrows, exchange_details } from '@tenda/shared/db/schema'
import { fiat_providers } from '@tenda/shared/db/schema/fiat'
import { getConfig } from '@server/config'
import { getExchangeRates } from '@server/lib/exchange-rates'
import { appEvents } from '@server/lib/events'
import type { SupportedCurrency } from '@tenda/shared'
import { AppError } from '@server/lib/errors'
import { ErrorCode } from '@tenda/shared'
import { P2P_INTERNAL_ID, P2P_INTERNAL_PAYMENT_WINDOW_SECONDS } from './config'
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
 * Offramp via the v2 exchange: open a sell escrow (kind='exchange',
 * draft) on the user's behalf — the user publishes it from the exchange
 * surface (signs the escrow tx), buyers fulfil, and `status` maps the
 * escrow lifecycle.
 */
function drizzleP2pFulfilment(fastify: FastifyInstance): P2pFulfilment {
  return {
    async open(input) {
      if (input.direction !== 'offramp') {
        throw new AppError(503, ErrorCode.PROVIDER_UNAVAILABLE, 'p2p onramp lands with the v2 exchange')
      }
      // The asset registry owns the asset → chain mapping.
      const [asset] = await fastify.db
        .select({ chain_id: assets.chain_id })
        .from(assets)
        .where(eq(assets.id, input.asset))
        .limit(1)
      if (asset === undefined) {
        throw new AppError(
          503,
          ErrorCode.PROVIDER_UNAVAILABLE,
          `asset '${input.asset}' is not registered — cannot open a p2p offer`,
        )
      }
      // Escrow + details land together or not at all.
      const escrow_id = await fastify.db.transaction(async (tx) => {
        const [escrow] = await tx
          .insert(escrows)
          .values({
            kind: 'exchange',
            chain_id: asset.chain_id,
            asset: input.asset,
            amount_raw: input.asset_amount_raw,
            creator_id: input.user_id,
            status: 'draft',
          })
          .returning({ id: escrows.id })
        await tx.insert(exchange_details).values({
          escrow_id: escrow.id,
          fiat_amount: input.fiat_amount.toFixed(4),
          fiat_currency: input.fiat_currency,
          rate: String(input.rate),
          payment_window_seconds: P2P_INTERNAL_PAYMENT_WINDOW_SECONDS,
        })
        return escrow.id
      })
      return { offer_id: escrow_id }
    },

    async status(offer_id) {
      const [escrow] = await fastify.db
        .select({ status: escrows.status })
        .from(escrows)
        .where(eq(escrows.id, offer_id))
        .limit(1)
      if (escrow === undefined) return 'not_found'
      if (escrow.status === 'completed' || escrow.status === 'resolved') return 'completed'
      if (escrow.status === 'cancelled' || escrow.status === 'refunded') return 'failed'
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
