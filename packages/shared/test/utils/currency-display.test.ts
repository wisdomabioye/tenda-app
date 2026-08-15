import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  formatFiat,
  formatFiatShort,
  formatPaymentWindow,
  formatSolDisplay,
  toAssetPaymentDisplay,
} from '../../src/utils/currency-display'

test('toAssetPaymentDisplay: converts raw base units through ASSET_META decimals', () => {
  const usdc = toAssetPaymentDisplay('5000000', 'USDC_SOL', null)
  assert.equal(usdc.amount, 5)
  assert.equal(usdc.symbol, 'USDC')
  assert.equal(usdc.fiat, null)
})

test('toAssetPaymentDisplay: SOL gets a fiat equivalent from a positive rate', () => {
  const sol = toAssetPaymentDisplay('1000000000', 'SOL', 150)
  assert.equal(sol.amount, 1)
  assert.equal(sol.symbol, 'SOL')
  assert.equal(sol.fiat, 150)
})

test('toAssetPaymentDisplay: no fiat on null or non-positive rate, or non-SOL assets', () => {
  assert.equal(toAssetPaymentDisplay('1000000000', 'SOL', null).fiat, null)
  assert.equal(toAssetPaymentDisplay('1000000000', 'SOL', 0).fiat, null)
  assert.equal(toAssetPaymentDisplay('5000000', 'USDC_SOL', 150).fiat, null)
})

test('toAssetPaymentDisplay: unknown asset falls back to the raw id and value', () => {
  const odd = toAssetPaymentDisplay('42', 'MYSTERY', 10)
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
