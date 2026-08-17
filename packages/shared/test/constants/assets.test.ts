import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  ASSET_META,
  GIG_STABLE_MIN_RAW,
  GIG_STABLE_MAX_RAW,
  amountRawToDisplay,
  formatAssetAmount,
  splitAssetAmount,
} from '../../src/constants/assets'

test('ASSET_META: every entry has a symbol, non-negative decimals, boolean is_stable, coingeckoId', () => {
  for (const [id, meta] of Object.entries(ASSET_META)) {
    assert.ok(meta.symbol.length > 0, `${id} symbol`)
    assert.ok(Number.isInteger(meta.decimals) && meta.decimals >= 0, `${id} decimals`)
    assert.equal(typeof meta.is_stable, 'boolean', `${id} is_stable`)
    assert.ok(meta.coingeckoId.length > 0, `${id} coingeckoId`)
  }
})

test('ASSET_META: stablecoins are flagged, native coins are not', () => {
  assert.equal(ASSET_META.USDC_SOL.is_stable, true)
  assert.equal(ASSET_META.USDC_BASE.is_stable, true)
  assert.equal(ASSET_META.cUSD.is_stable, true)
  assert.equal(ASSET_META.SOL.is_stable, false)
  assert.equal(ASSET_META.ETH_BASE.is_stable, false)
})

test('ASSET_META: native gas tokens carry a long-form name for AppKit nativeCurrency', () => {
  assert.equal(ASSET_META.ETH_BASE.name, 'Ether')
  assert.equal(ASSET_META.CELO.name, 'Celo')
  assert.equal(ASSET_META.SOL.name, 'Solana')
})

test('GIG_STABLE bounds are ordered and positive', () => {
  assert.ok(GIG_STABLE_MIN_RAW > 0)
  assert.ok(GIG_STABLE_MAX_RAW > GIG_STABLE_MIN_RAW)
})

test('amountRawToDisplay: divides by 10**decimals per asset', () => {
  assert.equal(amountRawToDisplay('5000000', 'USDC_SOL'), 5) // 6dp
  assert.equal(amountRawToDisplay('50000000', 'SOL'), 0.05) // 9dp
  assert.equal(amountRawToDisplay('0', 'USDC_SOL'), 0)
})

test('amountRawToDisplay: unknown asset falls back to the raw numeric value', () => {
  assert.equal(amountRawToDisplay('1234', 'MYSTERY'), 1234)
})

test('formatAssetAmount: renders value + symbol, rounding display to 4 dp', () => {
  assert.equal(formatAssetAmount('5000000', 'USDC_SOL'), '5 USDC')
  assert.equal(formatAssetAmount('50000000', 'SOL'), '0.05 SOL')
})

test('formatAssetAmount: unknown asset uses the asset id as the symbol', () => {
  assert.equal(formatAssetAmount('1000', 'MYSTERY'), '1,000 MYSTERY')
})

test('splitAssetAmount: returns the value and the ticker apart', () => {
  assert.deepEqual(splitAssetAmount('5000000', 'USDC_SOL'), { amount: '5', symbol: 'USDC' })
  assert.deepEqual(splitAssetAmount('50000000', 'SOL'), { amount: '0.05', symbol: 'SOL' })
})

test('splitAssetAmount: unknown asset uses the asset id as the symbol', () => {
  assert.deepEqual(splitAssetAmount('1000', 'MYSTERY'), { amount: '1,000', symbol: 'MYSTERY' })
})

test('splitAssetAmount: keeps grouping separators inside the VALUE half', () => {
  // The reason this function exists: splitting the joined string on a space
  // is fine, but splitting on the FIRST space is not, and neither survives a
  // future locale that groups with one. The halves are never re-parsed here.
  const { amount, symbol } = splitAssetAmount('1250500000', 'USDC_SOL')
  assert.equal(amount, '1,250.5')
  assert.equal(symbol, 'USDC')
})

test('splitAssetAmount: joined by a single space IS formatAssetAmount', () => {
  // Pins the delegation. If the two ever diverge, a card would show a
  // different figure from the detail page it opens.
  for (const [raw, asset] of [
    ['5000000', 'USDC_SOL'],
    ['1250500000', 'USDC_SOL'],
    ['50000000', 'SOL'],
    ['0', 'USDC_BASE'],
    ['1000', 'MYSTERY'],
    ['1000000000000000000', 'ETH_BASE'],
  ] as const) {
    const { amount, symbol } = splitAssetAmount(raw, asset)
    assert.equal(`${amount} ${symbol}`, formatAssetAmount(raw, asset), `${raw} ${asset}`)
  }
})

test('splitAssetAmount: zero is a value, never an empty half', () => {
  assert.deepEqual(splitAssetAmount('0', 'USDC_BASE'), { amount: '0', symbol: 'USDC' })
})
