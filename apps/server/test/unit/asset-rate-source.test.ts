/**
 * `assetRateSource` — the RateSource the internal P2P provider prices with (#97).
 *
 * It had no test of its own, and what it lacked was the REFUSALS specifically.
 * Its happy path does run in production shape elsewhere: the offramp-quote
 * cases in `integration/exchange-p2p.test.ts` stub `global.fetch` with a
 * CoinGecko body and assert the quoted fiat, which reaches this adapter through
 * the live route. What none of them touches is any path where a rate is NOT
 * found — and `fiat-rails.test.ts`'s p2p cases cannot help, because they supply
 * their own stub rate source and pass with this adapter arbitrarily broken.
 *
 * So the behaviour this file adds is the REFUSAL. `midRate` promises a `number`, so
 * every way it can fail to find one has to throw rather than hand back
 * `undefined` — a quote built on `undefined` becomes `NaN` and travels a long
 * way before anything notices. There are three such ways and they are genuinely
 * different: an asset the registry has never heard of, a currency outside the
 * vocabulary, and a currency inside it that the price feed simply did not
 * return. #97 folded the middle one into the same shape as the last by
 * narrowing with `isSupportedCurrency` instead of asserting the index — the
 * rates map is a `Partial` Record, so a miss is a real runtime state either way.
 */
import { test, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert'
import { assetRateSource } from '@server/features/fiat-rails/p2p-live'
import { invalidateExchangeRatesCache } from '@server/lib/exchange-rates'

/** A USDC asset id, so the CoinGecko id under test is a real registry value. */
const ASSET = 'USDC_SOL'

function jsonResponse(body: unknown): Response {
  return {
    ok: true,
    status: 200,
    json: () => Promise.resolve(body),
    text: () => Promise.resolve(JSON.stringify(body)),
  } as Response
}

/** What CoinGecko answers for usd-coin, keyed by its lowercased currency keys. */
function feedReturning(rates: Record<string, number>): typeof fetch {
  return (() => Promise.resolve(jsonResponse({ 'usd-coin': rates }))) as typeof fetch
}

const realFetch = globalThis.fetch

beforeEach(() => {
  // The rate cache is a module singleton and survives between tests in this
  // file, so a warmed entry would answer for a stub that never ran.
  invalidateExchangeRatesCache()
})
afterEach(() => {
  globalThis.fetch = realFetch
})

const is503 = (err: { statusCode?: number }) => err.statusCode === 503

test('midRate: prices a registry asset in a currency the feed returned', async () => {
  // The positive half. Without it every refusal below is satisfiable by a
  // midRate that throws unconditionally.
  globalThis.fetch = feedReturning({ ngn: 1_600, usd: 1 })
  assert.strictEqual(await assetRateSource().midRate(ASSET, 'NGN'), 1_600)
})

test('midRate: an asset outside ASSET_META is 503, and the feed is never called', async () => {
  // Refused before the network, because there is no coingecko id to ask with —
  // asserting the fetch did not happen is what distinguishes this from the
  // currency misses, which do reach the feed.
  let called = false
  globalThis.fetch = (() => {
    called = true
    return Promise.resolve(jsonResponse({}))
  }) as typeof fetch

  await assert.rejects(assetRateSource().midRate('NOT_AN_ASSET', 'NGN'), is503)
  assert.strictEqual(called, false, 'an unknown asset must not reach CoinGecko')
})

test('midRate: a currency outside the vocabulary is 503, not a NaN quote', async () => {
  // The arm #97 changed. 'XXX' is a well-formed ISO-shaped code that is not one
  // of ours, so the rates map cannot hold it however healthy the feed is.
  globalThis.fetch = feedReturning({ ngn: 1_600, usd: 1 })
  await assert.rejects(assetRateSource().midRate(ASSET, 'XXX'), is503)
})

test('midRate: a SUPPORTED currency the feed omitted is 503 too', async () => {
  // The other way a rate goes missing, and the one that is not a caller error:
  // KES is in the vocabulary and was asked for, and CoinGecko answered without
  // it. Same refusal, because a quote needs a number either way. This is the
  // case that proves the guard is not merely a restatement of the narrowing.
  globalThis.fetch = feedReturning({ ngn: 1_600, usd: 1 })
  await assert.rejects(assetRateSource().midRate(ASSET, 'KES'), is503)
})

test('midRate: the message names the currency that was missing', async () => {
  // The two currency refusals are indistinguishable by status alone, and this
  // string is what an operator reads in a 503 log line to tell "we do not
  // support that" from "the feed is degraded for a currency we do".
  await assert.rejects(
    (async () => {
      globalThis.fetch = feedReturning({ ngn: 1_600 })
      await assetRateSource().midRate(ASSET, 'ZAR')
    })(),
    (err: Error) => err.message.includes('ZAR'),
  )
})
