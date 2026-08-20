/**
 * The money helpers behind the budget field, tested directly.
 *
 * They were inside PaymentInput.tsx until #66, reachable only by rendering the
 * component and reading a TextInput's props — which is a fine way to test a
 * field and a poor way to test arithmetic. The rate-selection arms in
 * particular (stable vs native, and a USD leg that is missing or zero) each
 * misprice by orders of magnitude when wrong.
 */
import { fiatRatePerUnit, fiatTextToRaw, rawToFiatText } from '../payment-input.fiat'

/** NGN 150,000 per SOL, USD 100 per SOL -> NGN 1,500 per USDC. */
const RATES = { NGN: 150_000, USD: 100 }

describe('fiatRatePerUnit', () => {
  test('a stable divides out the USD leg', () => {
    expect(fiatRatePerUnit(RATES, 'NGN', 'USDC_SOL')).toBe(1_500)
  })

  test('a native token takes the rate straight from the cache', () => {
    // The other arm, and the one that would misprice by the USD rate — 100x
    // here — if the stable branch ever swallowed it.
    expect(fiatRatePerUnit(RATES, 'NGN', 'SOL_DEVNET')).toBe(150_000)
  })

  test('no rates at all is null, not zero — nothing may be converted yet', () => {
    // Zero would be a rate, and dividing by it yields Infinity; null is the
    // only honest answer and is what every caller branches on.
    expect(fiatRatePerUnit(null, 'NGN', 'USDC_SOL')).toBeNull()
    expect(fiatRatePerUnit(null, 'NGN', 'SOL_DEVNET')).toBeNull()
  })

  test('a currency missing from the cache is null', () => {
    expect(fiatRatePerUnit(RATES, 'KES', 'USDC_SOL')).toBeNull()
  })

  test('a missing or zero USD leg is null rather than a division', () => {
    expect(fiatRatePerUnit({ NGN: 150_000 }, 'NGN', 'USDC_SOL')).toBeNull()
    expect(fiatRatePerUnit({ NGN: 150_000, USD: 0 }, 'NGN', 'USDC_SOL')).toBeNull()
  })

  test('an asset outside the registry is treated as non-stable', () => {
    // `is_stable !== true` is the test, so an unknown asset takes the direct
    // rate rather than silently dividing by a leg that means nothing for it.
    expect(fiatRatePerUnit(RATES, 'NGN', 'NOT_A_REAL_ASSET')).toBe(150_000)
  })
})

describe('fiatTextToRaw', () => {
  test('converts a fiat amount into base units at the asset decimals', () => {
    expect(fiatTextToRaw('150000', 1_500, 'USDC_SOL')).toBe('100000000')
  })

  test('a half-typed number still converts — a trailing point reads as the number', () => {
    // The field hands over whatever is in it mid-entry, so '1500.' arrives
    // routinely. It must price as 1500 rather than as nothing.
    expect(fiatTextToRaw('1500.', 1_500, 'USDC_SOL')).toBe('1000000')
  })

  test('a lone point is not a budget', () => {
    // The other end of the same keystroke: '.' parses to NaN, which
    // gigBudgetFromUnits refuses rather than emitting a zero budget.
    expect(fiatTextToRaw('.', 1_500, 'USDC_SOL')).toBe('')
  })

  test('an empty field converts to no budget, not to zero', () => {
    expect(fiatTextToRaw('', 1_500, 'USDC_SOL')).toBe('')
  })
})

describe('rawToFiatText', () => {
  test('writes a budget in the currency, trimmed', () => {
    // 100 USDC at 150 KES-per-USDC. `toFixed(2)` pads this to '15000.00'; the
    // field must show what a person would type.
    expect(rawToFiatText('100000000', 150, 'USDC_SOL')).toBe('15000')
  })

  test('keeps the cents that matter', () => {
    expect(rawToFiatText('100000000', 15.005, 'USDC_SOL')).toBe('1500.5')
  })

  test('round-trips against fiatTextToRaw at the same rate', () => {
    // The property that makes option (b) safe: restating a budget and reading
    // it back must land on the budget it started from.
    const raw = fiatTextToRaw('150000', 1_500, 'USDC_SOL')
    expect(fiatTextToRaw(rawToFiatText(raw, 1_500, 'USDC_SOL'), 1_500, 'USDC_SOL')).toBe(raw)
  })

  test('no budget yields no text — an unset field, not a zero', () => {
    expect(rawToFiatText('', 1_500, 'USDC_SOL')).toBe('')
  })

  test('an 18-decimal budget survives the trip', () => {
    // 1250.75 cUSD at 2 fiat-per-unit. The raw is past what a float holds, so
    // a naive implementation loses digits before the multiply.
    expect(rawToFiatText('1250750000000000000000', 2, 'cUSD')).toBe('2501.5')
  })

  test('a rate that is not a positive number yields nothing', () => {
    // The function is exported, so its contract is not only what the component
    // happens to pass. Zero would make every budget worth nothing and Infinity
    // would make the multiply non-finite; both answer '' rather than emitting
    // '0' or 'Infinity' into the field.
    expect(rawToFiatText('100000000', 0, 'USDC_SOL')).toBe('')
    expect(rawToFiatText('100000000', Number.POSITIVE_INFINITY, 'USDC_SOL')).toBe('')
  })

  test('a rate so large the amount leaves decimal notation yields nothing', () => {
    // `toFixed` returns exponential above 1e21, which is not a decimal string —
    // the same end `gigBudgetFromUnits` refuses explicitly. A blank field beats
    // one reading '1.5e+23'.
    expect(rawToFiatText('100000000', 1e21, 'USDC_SOL')).toBe('')
  })
})
