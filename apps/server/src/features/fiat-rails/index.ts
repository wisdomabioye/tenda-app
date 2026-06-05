/**
 * Fiat-rails public surface (stage-8-fiat-rails.md). Routes/webhooks/jobs
 * import from HERE — never from the module internals (exit criterion:
 * single import surface).
 *
 * `buildFiatDeps(fastify)` assembles the live dependency set:
 *  - p2p_internal: always present. The drizzle fulfilment opens v2
 *    exchange escrows for offramp; onramp (CO4) quotes against live sell
 *    offers in the order book and hands the buyer the matched offer.
 *  - yellowcard / onrampmoney: present only when their env credentials
 *    exist (#61) — a missing key means the provider simply isn't offered.
 */

import type { FastifyInstance } from 'fastify'
import { and, asc, eq, gt, isNull, ne, or, sql, type SQL } from 'drizzle-orm'
import { assets, escrows, exchange_details } from '@tenda/shared/db/schema'
import { fiat_providers } from '@tenda/shared/db/schema/fiat'
import { getConfig } from '@server/config'
import { getExchangeRates } from '@server/lib/exchange-rates'
import { appEvents } from '@server/lib/events'
import type { SupportedCurrency } from '@tenda/shared'
import { AppError } from '@server/lib/errors'
import { DEFAULT_ACCEPT_WINDOW_SECONDS, ErrorCode } from '@tenda/shared'
import {
  P2P_INTERNAL_ID,
  P2P_INTERNAL_PAYMENT_WINDOW_SECONDS,
  P2P_ONRAMP_MATCH_TOLERANCE_BPS,
} from './config'
import { drizzleFiatStore } from './store'
import {
  p2pInternalProvider,
  type P2pFulfilment,
  type P2pOrderBook,
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

// ---------- live P2P order book + fulfilment ------------------------------------

/** Live-offer conditions shared by the order book and the initiate re-check. */
function liveOfferConditions(now: Date): SQL[] {
  return [
    eq(escrows.kind, 'exchange'),
    eq(escrows.status, 'open'),
    eq(escrows.hidden, false),
    or(isNull(escrows.accept_deadline), gt(escrows.accept_deadline, now)) as SQL,
  ]
}

/**
 * Onramp matching (CO4): exchange escrows are all-or-nothing, so the best
 * match is the live offer whose fiat size sits closest to the request
 * within ±tolerance. The buyer's own offers never match.
 */
function drizzleP2pOrderBook(fastify: FastifyInstance): P2pOrderBook {
  return {
    async bestMatch({ buyer_id, asset, fiat_currency, fiat_amount }) {
      const tolerance = P2P_ONRAMP_MATCH_TOLERANCE_BPS / 10_000
      const lo = (fiat_amount * (1 - tolerance)).toFixed(4)
      const hi = (fiat_amount * (1 + tolerance)).toFixed(4)
      const [row] = await fastify.db
        .select({
          offer_id: escrows.id,
          fiat_amount: exchange_details.fiat_amount,
          asset_amount_raw: escrows.amount_raw,
          rate: exchange_details.rate,
        })
        .from(escrows)
        .innerJoin(exchange_details, eq(exchange_details.escrow_id, escrows.id))
        .where(
          and(
            ...liveOfferConditions(new Date()),
            eq(escrows.asset, asset),
            ne(escrows.creator_id, buyer_id),
            eq(exchange_details.fiat_currency, fiat_currency),
            sql`${exchange_details.fiat_amount} BETWEEN ${lo} AND ${hi}`,
          ),
        )
        // Closest size first; cheapest rate breaks ties.
        .orderBy(
          sql`ABS(${exchange_details.fiat_amount} - ${fiat_amount.toFixed(4)})`,
          asc(exchange_details.rate),
        )
        .limit(1)
      if (row === undefined) return null
      return {
        offer_id: row.offer_id,
        fiat_amount: Number(row.fiat_amount),
        asset_amount_raw: row.asset_amount_raw,
        rate: Number(row.rate),
      }
    },
  }
}

/**
 * Offramp via the v2 exchange: open a sell escrow (kind='exchange',
 * draft) on the user's behalf — the user publishes it from the exchange
 * surface (signs the escrow tx), buyers fulfil, and `status` maps the
 * escrow lifecycle. Onramp (CO4): re-validate the quote-time matched
 * offer and hand it to the buyer to accept on-chain.
 */
function drizzleP2pFulfilment(fastify: FastifyInstance): P2pFulfilment {
  return {
    async open(input) {
      if (input.direction === 'onramp') {
        if (input.offer_ref === undefined) {
          throw new AppError(503, ErrorCode.PROVIDER_UNAVAILABLE, 'onramp intent carries no matched offer')
        }
        // The offer may have been accepted/cancelled/hidden since the
        // quote — re-check it is still live and not the buyer's own.
        const [offer] = await fastify.db
          .select({ id: escrows.id })
          .from(escrows)
          .where(
            and(
              ...liveOfferConditions(new Date()),
              eq(escrows.id, input.offer_ref),
              ne(escrows.creator_id, input.user_id),
            ),
          )
          .limit(1)
        if (offer === undefined) {
          throw new AppError(503, ErrorCode.PROVIDER_UNAVAILABLE, 'the matched offer is no longer available')
        }
        return { offer_id: offer.id }
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
      // Escrow + details land together or not at all. The deadlines are
      // stamped HERE so the draft is publishable as-is via build-create —
      // accept window = the shared default; completion window = the time
      // the buyer gets to pay fiat after accepting.
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
            accept_deadline: new Date(Date.now() + DEFAULT_ACCEPT_WINDOW_SECONDS * 1000),
            completion_duration_seconds: P2P_INTERNAL_PAYMENT_WINDOW_SECONDS,
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

    async status(offer_id, ctx) {
      const [escrow] = await fastify.db
        .select({
          status: escrows.status,
          counterparty_id: escrows.counterparty_id,
          hidden: escrows.hidden,
          accept_deadline: escrows.accept_deadline,
        })
        .from(escrows)
        .where(eq(escrows.id, offer_id))
        .limit(1)
      if (escrow === undefined) return 'not_found'

      // Onramp: the intent only completes if the offer settled with THIS
      // buyer. A rival accepting (or the seller cancelling, a takedown,
      // or the window lapsing) means the match is gone — fail the intent
      // so the buyer re-quotes instead of waiting on someone else's trade.
      if (ctx?.direction === 'onramp') {
        const mine = escrow.counterparty_id === ctx.user_id
        if (escrow.status === 'completed' || escrow.status === 'resolved') {
          return mine ? 'completed' : 'failed'
        }
        if (escrow.status === 'accepted' || escrow.status === 'submitted' || escrow.status === 'disputed') {
          return mine ? 'pending' : 'failed'
        }
        if (escrow.status === 'open') {
          const live =
            !escrow.hidden &&
            (escrow.accept_deadline === null || escrow.accept_deadline.getTime() > Date.now())
          return live ? 'pending' : 'failed'
        }
        // draft / cancelled / refunded — the offer never traded (with anyone).
        return 'failed'
      }

      // Offramp (the intent user IS the offer creator): the escrow's own
      // lifecycle is the intent's lifecycle.
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
      book: drizzleP2pOrderBook(fastify),
      fulfilment: drizzleP2pFulfilment(fastify),
      capabilities: {
        // CO4: onramp quotes against live sell offers (no offer → no quote).
        onramp: true,
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
