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
 * way before anything notices.
 *
 * The cross rate changed that list. "A currency inside the vocabulary that the
 * price feed did not return" used to be a refusal and is now the case the cross
 * exists for: CoinGecko carries no `ghs` and no `kes`, which is why Ghana and
 * Kenya had no instant-sell quote while every other payout market did. What
 * remains a refusal is an asset the registry never heard of, a currency outside
 * the vocabulary, a missing USD leg, and a currency NEITHER feed carries.
 *
 * Both feeds are stubbed apart by URL throughout, because a stub answering the
 * same body to both would let a broken second leg pass unnoticed.
 */
import { test, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert'
import { assetRateSource } from '@server/features/fiat-rails/p2p-live'
import { invalidateExchangeRatesCache } from '@server/lib/exchange-rates'
import { invalidateFxRatesCache, FX_RATES_URL } from '@server/lib/fx-rates'

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

/**
 * What CoinGecko answers for usd-coin, keyed by its lowercased currency keys.
 * The FX endpoint answers nothing, so a test using this exercises the direct
 * path and the refusals — never the cross.
 */
function feedReturning(rates: Record<string, number>): typeof fetch {
  return (() => Promise.resolve(jsonResponse({ 'usd-coin': rates }))) as typeof fetch
}

/**
 * Both feeds, told apart by URL. The cross-rate reads two upstreams, so a stub
 * that answered the same body to both would let a broken second leg pass.
 */
function feedsReturning(
  coingecko: Record<string, number>,
  fx: Record<string, number> | null,
): typeof fetch {
  return ((url: string) => {
    if (String(url) === FX_RATES_URL) {
      return fx === null
        ? Promise.reject(new Error('fx down'))
        : Promise.resolve(jsonResponse({ rates: fx }))
    }
    return Promise.resolve(jsonResponse({ 'usd-coin': coingecko }))
  }) as typeof fetch
}

const realFetch = globalThis.fetch

beforeEach(() => {
  // Both rate caches are module singletons and survive between tests in this
  // file, so a warmed entry would answer for a stub that never ran.
  invalidateExchangeRatesCache()
  invalidateFxRatesCache()
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

test('midRate: a currency outside the vocabulary is 503, and reaches neither leg', async () => {
  // The arm #97 changed. 'XXX' is a well-formed ISO-shaped code that is not one
  // of ours, so the rates map cannot hold it however healthy the feed is.
  //
  // Asserting the FX feed was NOT called is what keeps this from being
  // satisfied by the cross path failing anyway: the FX rates are filtered to
  // our vocabulary, so an unknown code would fall through and 503 a moment
  // later regardless. The guard's job is to refuse BEFORE the second network
  // call, and only this assertion can tell the two apart.
  let fxCalled = false
  globalThis.fetch = ((url: string) => {
    if (String(url) === FX_RATES_URL) fxCalled = true
    return Promise.resolve(jsonResponse({ 'usd-coin': { ngn: 1_600, usd: 1 }, rates: { NGN: 1_350 } }))
  }) as typeof fetch

  await assert.rejects(assetRateSource().midRate(ASSET, 'XXX'), is503)
  assert.strictEqual(fxCalled, false, 'an unknown currency must not reach the FX feed')
})

/**
 * THE CASE THE CROSS RATE EXISTS FOR, and it used to be the 503 above.
 *
 * KES is in the vocabulary and is asked for, and CoinGecko answers without it —
 * not a caller error and not transient: `kes` is simply not one of the ~60
 * fiats it prices in, so Ghana and Kenya had no instant-sell quote at all while
 * every other payout market did. Crossing through USD recovers it.
 */
test('midRate: a currency CoinGecko omits is crossed through USD, not refused', async () => {
  globalThis.fetch = feedsReturning({ ngn: 1_600, usd: 0.9997 }, { KES: 129.455985 })
  // 0.9997 × 129.455985 — the asset's REAL USD price, not an assumed 1.0 peg,
  // so a depeg reaches the quote instead of being rounded away.
  assert.strictEqual(await assetRateSource().midRate(ASSET, 'KES'), 0.9997 * 129.455985)
})

test('midRate: the direct rate wins when the feed has one, and no FX call is made', async () => {
  // Order matters for more than efficiency: it is what makes the market list
  // self-correcting. The day CoinGecko starts returning `ghs`, the better rate
  // is used with nobody editing a list of "cross-rate currencies".
  let fxCalled = false
  globalThis.fetch = ((url: string) => {
    if (String(url) === FX_RATES_URL) {
      fxCalled = true
      return Promise.resolve(jsonResponse({ rates: { NGN: 9_999 } }))
    }
    return Promise.resolve(jsonResponse({ 'usd-coin': { ngn: 1_600, usd: 1 } }))
  }) as typeof fetch

  assert.strictEqual(await assetRateSource().midRate(ASSET, 'NGN'), 1_600)
  assert.strictEqual(fxCalled, false, 'a direct rate must not trigger the FX leg')
})

test('midRate: no USD leg means no cross, and the FX feed is spared the call', async () => {
  // Half a cross rate is not a rate. Without the USD price there is nothing to
  // multiply, so this refuses before the second network call — asserting that
  // is what separates this from the both-legs-missing case below, which fails
  // only after the FX feed has answered.
  let fxCalled = false
  globalThis.fetch = ((url: string) => {
    if (String(url) === FX_RATES_URL) {
      fxCalled = true
      return Promise.resolve(jsonResponse({ rates: { KES: 129.45 } }))
    }
    return Promise.resolve(jsonResponse({ 'usd-coin': { ngn: 1_600 } }))
  }) as typeof fetch

  await assert.rejects(assetRateSource().midRate(ASSET, 'KES'), is503)
  assert.strictEqual(fxCalled, false, 'no USD leg means the FX rate cannot help')
})

test('midRate: a currency neither feed carries is a 503', async () => {
  // The refusal that survives the cross: CoinGecko omits KES and so does the
  // FX feed, so both legs are dead and there is no third path.
  globalThis.fetch = feedsReturning({ ngn: 1_600, usd: 1 }, { NGN: 1_350 })
  await assert.rejects(assetRateSource().midRate(ASSET, 'KES'), is503)
})

test('midRate: an FX outage with nothing cached surfaces, it does not quote NaN', async () => {
  globalThis.fetch = feedsReturning({ ngn: 1_600, usd: 1 }, null)
  await assert.rejects(assetRateSource().midRate(ASSET, 'KES'), is503)
})

test('midRate: the message names the currency that was missing', async () => {
  // The two currency refusals are indistinguishable by status alone, and this
  // string is what an operator reads in a 503 log line to tell "we do not
  // support that" from "the feed is degraded for a currency we do".
  await assert.rejects(
    (async () => {
      // Starves both legs — with a USD price and an FX rate this now succeeds,
      // so the refusal has to be built from a currency neither feed carries.
      globalThis.fetch = feedsReturning({ ngn: 1_600, usd: 1 }, { NGN: 1_350 })
      await assetRateSource().midRate(ASSET, 'ZAR')
    })(),
    (err: Error) => err.message.includes('ZAR'),
  )
})
