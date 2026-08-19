import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  ASSET_META,
  GIG_NATIVE_MAX_DISPLAY,
  GIG_NATIVE_MIN_DISPLAY,
  GIG_STABLE_MAX_DISPLAY,
  GIG_STABLE_MIN_DISPLAY,
  amountRawToDisplay,
  formatAssetAmount,
  splitAssetAmount,
} from '../../src/constants/assets'
import { parseUnits, formatUnits } from '../../src/utils/units'

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

test('the gig rails are ordered, positive, and PARSEABLE as display amounts', () => {
  // They are display strings now, and gigAmountBounds runs them through
  // parseUnits — which answers null for anything malformed and would silently
  // turn a typo here into a bound of '0'. So the parse is what is asserted,
  // not just the ordering.
  for (const [min, max] of [
    [GIG_STABLE_MIN_DISPLAY, GIG_STABLE_MAX_DISPLAY],
    [GIG_NATIVE_MIN_DISPLAY, GIG_NATIVE_MAX_DISPLAY],
  ]) {
    for (const value of [min, max]) {
      const raw = parseUnits(value, 18)
      assert.notEqual(raw, null, value)
      assert.ok(BigInt(raw as string) > 0n, value)
    }
    assert.ok(BigInt(parseUnits(max, 18) as string) > BigInt(parseUnits(min, 18) as string))
  }
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

test('amountRawToDisplay: exact at 4dp across the realistic range, for an 18-decimal asset', () => {
  // Pins the bound the docstring states (#50), so an "optimisation" that
  // widened the loss would be caught. Compared against formatUnits, which is
  // BigInt-exact, at the 4 decimal places the app actually renders.
  const at4 = (raw: string) => amountRawToDisplay(raw, 'cUSD').toFixed(4)
  const exactAt4 = (raw: string) => {
    const [whole, frac = ''] = formatUnits(raw, 18).split('.')
    return Number(`${whole}.${(frac + '00000').slice(0, 5)}`).toFixed(4)
  }
  const raw = (tokens: string) => {
    const [whole, frac = ''] = tokens.split('.')
    return (BigInt(whole) * 10n ** 18n + BigInt((frac + '0'.repeat(18)).slice(0, 18))).toString()
  }
  for (const tokens of ['1250.7531', '12345.6789', '1234567.8912', '123456789.1234', '123456789012.3456']) {
    assert.equal(at4(raw(tokens)), exactAt4(raw(tokens)), `diverged at ${tokens} tokens`)
  }
})

test('amountRawToDisplay: asking for the asset FULL decimals is what breaks it', () => {
  // The measured sharp edge, kept visible so nobody reintroduces it: at 18
  // decimals a double cannot carry the fraction, and the loss starts around
  // one token — nowhere near the ~1.2e12 ceiling the 4dp reading enjoys.
  const raw = '1234567890123456789' // 1.234567890123456789 cUSD
  assert.equal(formatUnits(raw, 18), '1.234567890123456789')
  assert.notEqual(
    amountRawToDisplay(raw, 'cUSD').toLocaleString('en-US', { maximumFractionDigits: 18 }),
    '1.234567890123456789',
  )
  // ...while the 4dp reading every surface uses stays honest.
  assert.equal(splitAssetAmount(raw, 'cUSD').amount, '1.2346')
})
