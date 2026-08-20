import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  formatFiat,
  formatFiatShort,
  formatPaymentWindow,
  formatRate,
  formatSolDisplay,
  toAssetPaymentDisplay,
  fiatRatePerUnit,
} from '../../src/utils/currency-display'

/** A populated cache: NGN 150,000 per SOL, USD 150 per SOL. */
const RATES = { NGN: 150_000, USD: 150 }

test('fiatRatePerUnit: SOL takes the cache rate straight', () => {
  assert.equal(fiatRatePerUnit(RATES, 'NGN', 'SOL'), 150_000)
  // Keyed on the SYMBOL, so the devnet id prices identically.
  assert.equal(fiatRatePerUnit(RATES, 'NGN', 'SOL_DEVNET'), 150_000)
})

test('fiatRatePerUnit: a stable divides the USD leg out', () => {
  // NGN 150,000 per SOL / USD 150 per SOL = NGN 1,000 per USDC.
  assert.equal(fiatRatePerUnit(RATES, 'NGN', 'USDC_SOL'), 1_000)
  assert.equal(fiatRatePerUnit(RATES, 'NGN', 'cUSD'), 1_000)
})

test('fiatRatePerUnit: a native token that is NOT SOL has no rate in this cache', () => {
  // The arm #76 added. Mobile's copy returned the SOL rate here, which prices a
  // unit of ETH as a unit of SOL. A card renders whatever `asset` the wire
  // carries, so the wrong number needed no picker to reach it. Null is the
  // honest answer until the cache carries a per-asset rate.
  assert.equal(fiatRatePerUnit(RATES, 'NGN', 'ETH_BASE'), null)
  assert.equal(fiatRatePerUnit(RATES, 'NGN', 'CELO'), null)
})

test('fiatRatePerUnit: unknown assets and missing rates answer null', () => {
  assert.equal(fiatRatePerUnit(RATES, 'NGN', 'MYSTERY'), null)
  assert.equal(fiatRatePerUnit(null, 'NGN', 'SOL'), null)
  assert.equal(fiatRatePerUnit({ USD: 150 }, 'NGN', 'SOL'), null)
  // A stable needs BOTH legs, and a zero USD leg would divide to Infinity.
  assert.equal(fiatRatePerUnit({ NGN: 150_000 }, 'NGN', 'USDC_SOL'), null)
  assert.equal(fiatRatePerUnit({ NGN: 150_000, USD: 0 }, 'NGN', 'USDC_SOL'), null)
})

test('toAssetPaymentDisplay: converts raw base units through ASSET_META decimals', () => {
  const usdc = toAssetPaymentDisplay('5000000', 'USDC_SOL', null, 'NGN')
  assert.equal(usdc.amount, 5)
  assert.equal(usdc.symbol, 'USDC')
  assert.equal(usdc.fiat, null)
})

test('toAssetPaymentDisplay: SOL gets a fiat equivalent from a positive rate', () => {
  const sol = toAssetPaymentDisplay('1000000000', 'SOL', RATES, 'NGN')
  assert.equal(sol.amount, 1)
  assert.equal(sol.symbol, 'SOL')
  assert.equal(sol.fiat, 150_000)
})

test('toAssetPaymentDisplay: a STABLE now gets one too, through the USD leg', () => {
  // The whole of #76. This returned null before, so a USDC gig rendered its
  // amount with the "≈ ₦…" line beside it empty — while the composer showed a
  // naira figure for the same money.
  const usdc = toAssetPaymentDisplay('5000000', 'USDC_SOL', RATES, 'NGN')
  assert.equal(usdc.amount, 5)
  assert.equal(usdc.symbol, 'USDC')
  assert.equal(usdc.fiat, 5_000)
})

test('toAssetPaymentDisplay: no fiat without a usable rate', () => {
  assert.equal(toAssetPaymentDisplay('1000000000', 'SOL', null, 'NGN').fiat, null)
  assert.equal(toAssetPaymentDisplay('1000000000', 'SOL', { NGN: 0 }, 'NGN').fiat, null)
  // Still nothing for a native token the cache cannot price.
  assert.equal(toAssetPaymentDisplay('1000000000000000000', 'ETH_BASE', RATES, 'NGN').fiat, null)
})

test('toAssetPaymentDisplay: unknown asset falls back to the raw id and value', () => {
  const odd = toAssetPaymentDisplay('42', 'MYSTERY', RATES, 'NGN')
  assert.equal(odd.amount, 42)
  assert.equal(odd.symbol, 'MYSTERY')
  assert.equal(odd.fiat, null)
})

test('formatSolDisplay: at least two decimals, at most four', () => {
  assert.equal(formatSolDisplay(0.05), '0.05 SOL')
  assert.equal(formatSolDisplay(1), '1.00 SOL')
  assert.equal(formatSolDisplay(0.123456), '0.1235 SOL')
})

test('formatPaymentWindow: minutes under an hour, whole and fractional hours above', () => {
  assert.equal(formatPaymentWindow(1800), '30m')
  assert.equal(formatPaymentWindow(3600), '1h')
  assert.equal(formatPaymentWindow(5400), '1.5h')
  assert.equal(formatPaymentWindow(86_400), '24h')
})

test('formatFiat: whole-figure currency string in the currency locale', () => {
  const ngn = formatFiat(85_000, 'NGN')
  assert.match(ngn, /85,000/)
  assert.match(ngn, /^\D/)
  const usd = formatFiat(1_250, 'USD')
  assert.match(usd, /1,250/)
})

test('formatFiatShort: compacts thousands and millions, falls back below 1k', () => {
  assert.match(formatFiatShort(240_000, 'NGN'), /240k$/)
  assert.match(formatFiatShort(1_500_000, 'USD'), /1\.5M$/)
  // Below 1,000 it is the full formatFiat output, not a compacted one.
  assert.equal(formatFiatShort(500, 'USD'), formatFiat(500, 'USD'))
})

test('formatRate keeps the precision a rate is compared on', () => {
  // The order book's whole premise is "compare them straight down the column",
  // and `formatFiat` rounds to whole units — so two GHS offers at 15.40 and
  // 15.49 both printed "GH₵15" and the column could not be compared at all.
  assert.notEqual(formatRate(15.4, 'GHS'), formatRate(15.49, 'GHS'))
  assert.notEqual(formatRate(129.5, 'KES'), formatRate(129.9, 'KES'))
})

test('formatRate pads a fractional rate and leaves a whole one alone', () => {
  // A column of "15.40 / 15.49 / 16" reads; a column of "15.4 / 15.49 / 16.00"
  // does not. Whole rates stay whole — most NGN rates are.
  assert.equal(formatRate(15.4, 'GHS'), 'GH₵15.40')
  assert.equal(formatRate(1500, 'NGN'), '₦1,500')
  assert.equal(formatRate(1500.75, 'NGN'), '₦1,500.75')
})
