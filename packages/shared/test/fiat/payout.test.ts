import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  PAYOUT_COUNTRY_SPECS,
  SUPPORTED_PAYOUT_COUNTRIES,
  PAYOUT_CURRENCIES,
  PAYOUT_RAIL_KINDS,
  getPayoutSpec,
  countryDisplayName,
  getPayoutRail,
  isPayoutRailKind,
  payoutCurrencyForCountry,
} from '../../src/fiat/payout'
import { SUPPORTED_CURRENCIES } from '../../src/constants/currencies'
import { payoutRailKindEnum } from '../../src/db/schema/fiat'

// ---------- registry shape -------------------------------------------------

test('payout countries are exactly NG, KE, GH, ZA, PH, AE', () => {
  assert.deepEqual(new Set(SUPPORTED_PAYOUT_COUNTRIES), new Set(['NG', 'KE', 'GH', 'ZA', 'PH', 'AE']))
})

test('PAYOUT_CURRENCIES is derived, deduped, and a subset of SUPPORTED_CURRENCIES', () => {
  assert.deepEqual(new Set(PAYOUT_CURRENCIES), new Set(['NGN', 'KES', 'GHS', 'ZAR', 'PHP', 'AED']))
  for (const c of PAYOUT_CURRENCIES) {
    assert.ok(SUPPORTED_CURRENCIES.includes(c), `${c} must be a supported currency`)
  }
})

test('one country maps to exactly one currency', () => {
  // The model the product deliberately keeps: currency is INFERRED from the
  // account's country, never stored. A spec declaring two would mean that
  // inference had quietly stopped being total.
  for (const spec of Object.values(PAYOUT_COUNTRY_SPECS)) {
    assert.ok(SUPPORTED_CURRENCIES.includes(spec.currency))
  }
})

test('every market declares a rail, matches its key, and collects every column', () => {
  for (const [code, spec] of Object.entries(PAYOUT_COUNTRY_SPECS)) {
    assert.ok(spec.rails.length > 0, `${code} declares no rail`)
    assert.equal(spec.country, code, `${code} spec disagrees with its registry key`)
    const kinds = spec.rails.map((r) => r.kind)
    assert.equal(new Set(kinds).size, kinds.length, `${code} repeats a rail kind`)
    for (const rail of spec.rails) {
      // A column the form never collects is a column that saves blank.
      const columns = new Set(rail.fields.map((f) => f.column))
      for (const required of ['bank_code', 'account_number', 'account_name'] as const) {
        assert.ok(columns.has(required), `${code}/${rail.kind} never collects ${required}`)
      }
    }
  }
})

test('every spec is structurally sound (currency, ≥1 rail, fields map to columns)', () => {
  const columns = new Set(['bank_code', 'account_number', 'account_name'])
  for (const [code, spec] of Object.entries(PAYOUT_COUNTRY_SPECS)) {
    assert.equal(spec.country, code)
    assert.ok(spec.rails.length >= 1, `${code} needs a rail`)
    assert.ok(SUPPORTED_CURRENCIES.includes(spec.currency))
    for (const rail of spec.rails) {
      assert.ok(rail.fields.length > 0, `${code}/${rail.kind} needs fields`)
      for (const f of rail.fields) {
        assert.ok(columns.has(f.column), `${code}/${rail.kind} field column ${f.column}`)
      }
    }
  }
})

test('PAYOUT_RAIL_KINDS is the single source: it equals the payout_rail_kind DB enum', () => {
  // The route validates against PAYOUT_RAIL_KINDS and the union type derives
  // from it; pinning it to the DB enum closes the last drift edge so the three
  // representations (const, union, enum) can never diverge silently.
  assert.deepEqual([...PAYOUT_RAIL_KINDS], [...payoutRailKindEnum.enumValues])
})

test('isPayoutRailKind narrows known values and rejects everything else', () => {
  for (const k of PAYOUT_RAIL_KINDS) assert.ok(isPayoutRailKind(k))
  for (const bad of ['crypto', '', 'BANK', undefined, null, 7]) assert.equal(isPayoutRailKind(bad), false)
})

test('every rail kind used by a spec is a known PAYOUT_RAIL_KIND (no drift)', () => {
  for (const spec of Object.values(PAYOUT_COUNTRY_SPECS)) {
    for (const rail of spec.rails) {
      assert.ok(isPayoutRailKind(rail.kind), `rail kind '${rail.kind}' must be a known kind`)
    }
  }
})

test('payoutCurrencyForCountry resolves every market to its own currency', () => {
  for (const country of SUPPORTED_PAYOUT_COUNTRIES) {
    const currency = payoutCurrencyForCountry(country)
    assert.notEqual(currency, null, `${country} is a market but resolves no currency`)
    assert.equal(currency, PAYOUT_COUNTRY_SPECS[country].currency)
  }
  assert.equal(payoutCurrencyForCountry('ZA'), 'ZAR')
  assert.equal(payoutCurrencyForCountry('PH'), 'PHP')
  assert.equal(payoutCurrencyForCountry('AE'), 'AED')
})

/**
 * NO FALLBACK, deliberately. This used to answer NGN for anything it did not
 * recognise, which made "we do not serve this country" indistinguishable from
 * "this account is Nigerian" — so an unrecognised country SATISFIED the guard
 * on an NGN-priced offer instead of failing it, and the mobile composer showed
 * NGN to a Kenyan until they picked an account.
 */
test('payoutCurrencyForCountry answers null rather than guessing a currency', () => {
  assert.equal(payoutCurrencyForCountry('US'), null)
  assert.equal(payoutCurrencyForCountry('ZW'), null)
  assert.equal(payoutCurrencyForCountry(null), null)
  assert.equal(payoutCurrencyForCountry(''), null)
})

test('getPayoutSpec / getPayoutRail resolve and reject correctly', () => {
  assert.equal(getPayoutSpec('NG')?.currency, 'NGN')
  assert.equal(getPayoutSpec('US'), null)
  assert.ok(getPayoutRail('GH', 'mobile_money') !== null)
  assert.equal(getPayoutRail('NG', 'mobile_money'), null, 'NG has no MoMo rail')
  assert.equal(getPayoutRail('ZA', 'mobile_money'), null, 'ZA has no wallet rail')
  assert.ok(getPayoutRail('PH', 'mobile_money') !== null, 'PH e-wallets are first-class')
  assert.equal(getPayoutRail('ZZ', 'bank'), null)
})

test('every rail rejects a fully-empty input', () => {
  for (const spec of Object.values(PAYOUT_COUNTRY_SPECS)) {
    for (const rail of spec.rails) {
      const err = rail.validate({ bank_code: '', account_number: '', account_name: '' })
      assert.ok(typeof err === 'string' && err.length > 0, `${spec.country}/${rail.kind} must reject empty`)
    }
  }
})

// --- account-number masking ------------------------------------------------

/**
 * The mask is what a payout account shows once saved, so the tail length is a
 * per-rail decision rather than a constant: revealing four digits of a 10-digit
 * MoMo number is a different disclosure from four of a 16-digit bank account.
 */
test('every payout rail masks its account number, keeping only the declared tail', () => {
  for (const spec of Object.values(PAYOUT_COUNTRY_SPECS)) {
    for (const rail of spec.rails) {
      const masked = rail.maskAccountNumber('0123456789')
      assert.match(
        masked,
        /^•+ \d+$/,
        `${spec.country}/${rail.kind} mask has an unexpected shape: ${masked}`,
      )
      const tail = masked.split(' ')[1]
      assert.ok(
        '0123456789'.endsWith(tail),
        `${spec.country}/${rail.kind} revealed digits that are not the tail`,
      )
      assert.ok(tail.length < 10, `${spec.country}/${rail.kind} revealed the whole number`)
    }
  }
})

test('the Kenyan bank rail masks all but the last four', () => {
  const rail = getPayoutRail('KE', 'bank')
  assert.ok(rail)
  assert.equal(rail.maskAccountNumber('0123456789'), '•••••• 6789')
})

test('the Ghanaian bank rail masks all but the last four', () => {
  // GH momo keeps 3 (covered above); the bank rail keeps 4 — different rails,
  // different disclosure, so both are pinned.
  const rail = getPayoutRail('GH', 'bank')
  assert.ok(rail)
  assert.equal(rail.maskAccountNumber('1234567890123'), '••••••••• 0123')
})

test('countryDisplayName names a payout market, and passes anything else through', () => {
  assert.equal(countryDisplayName('NG'), 'Nigeria')
  assert.equal(countryDisplayName('KE'), 'Kenya')
  assert.equal(countryDisplayName('GH'), 'Ghana')
  // Not a payout market, but still where the account says it is. A dash here
  // would say less to the reader than the code does.
  assert.equal(countryDisplayName('ZW'), 'ZW')
})

test('countryDisplayName answers null for an account with no country', () => {
  // The column is nullable; the caller renders NOTHING rather than a
  // placeholder that implies a country was withheld.
  assert.equal(countryDisplayName(null), null)
  assert.equal(countryDisplayName(''), null)
})

test('every payout market has a display name, so none can fall back to its code', () => {
  for (const country of SUPPORTED_PAYOUT_COUNTRIES) {
    assert.notEqual(countryDisplayName(country), country)
  }
})

// ---------- disabling a market ---------------------------------------------

/**
 * Disabling a market is commenting its line out of PAYOUT_COUNTRY_SPECS, so
 * these pin the two properties that make that sufficient — and the one that
 * makes it SAFE.
 *
 * Sufficient: every derived list reads the registry rather than restating it,
 * so removing a line removes the market everywhere at once.
 *
 * Safe: a country that is not in the registry resolves to NOTHING, not to a
 * neighbour. Before the fallback was removed, commenting out a market made its
 * accounts resolve to NGN — so disabling a corridor would have silently
 * re-pointed its users at Nigeria, and their existing accounts would have
 * satisfied the guard on a naira-priced offer.
 *
 * 'US' and 'ZW' stand in for a commented-out market: to every function here,
 * a disabled country and a country we never had are the same thing.
 */
const DISABLED = 'US'

test('disabling a market: every derived list agrees with the registry', () => {
  assert.deepEqual(SUPPORTED_PAYOUT_COUNTRIES, Object.keys(PAYOUT_COUNTRY_SPECS))
  assert.deepEqual(
    new Set(PAYOUT_CURRENCIES),
    new Set(Object.values(PAYOUT_COUNTRY_SPECS).map((s) => s.currency)),
  )
})

/**
 * AND THE VALUES ARE DERIVED, not merely correct. The assertion above compares
 * two things that agree today, so it passes just as happily for a hand-written
 * `['NG','KE','GH','ZA','PH','AE']` — proved by replacing the derivation with
 * exactly that literal and watching every test stay green. A hand-list would
 * fail only on the day a market is commented out and the list is not, which is
 * the day the check exists for. So this one reads the source.
 */
test('disabling a market: the lists are computed from the registry, not restated', () => {
  const source = readFileSync(resolve(__dirname, '../../src/fiat/payout/index.ts'), 'utf8')
  assert.match(
    source,
    /SUPPORTED_PAYOUT_COUNTRIES[^=]*=\s*Object\.keys\(PAYOUT_COUNTRY_SPECS\)/,
    'SUPPORTED_PAYOUT_COUNTRIES must be Object.keys of the registry',
  )
  assert.match(
    source,
    /PAYOUT_CURRENCIES[^=]*=[\s\S]*Object\.values\(PAYOUT_COUNTRY_SPECS\)/,
    'PAYOUT_CURRENCIES must be derived from the registry specs',
  )
})

test('disabling a market: the country resolves to nothing anywhere', () => {
  assert.equal(getPayoutSpec(DISABLED), null)
  assert.equal(getPayoutRail(DISABLED, 'bank'), null)
  assert.equal(getPayoutRail(DISABLED, 'mobile_money'), null)
  assert.equal(payoutCurrencyForCountry(DISABLED), null)
  assert.ok(!SUPPORTED_PAYOUT_COUNTRIES.includes(DISABLED))
})

/**
 * The specific regression. A disabled country must never inherit a currency
 * from a market that is still live — that is what turns "we stopped serving
 * you" into "you now quote in someone else's money".
 */
test('disabling a market: its country never inherits a live market currency', () => {
  for (const country of [DISABLED, 'ZW', 'XX', '']) {
    // `null` IS the assertion. A follow-up `!PAYOUT_CURRENCIES.includes(...)`
    // stood here and could never fail: the line above has already established
    // the value is null, so it only ever asked whether the list contains null.
    // It also needed an `as never` to compile, which was the tell.
    assert.equal(payoutCurrencyForCountry(country), null, `${country} resolved to a currency`)
  }
})

/**
 * The currency vocabulary is deliberately NOT the market list. Retiring a
 * market must not break the display of trades that already happened in it, so
 * SUPPORTED_CURRENCIES stays wider than PAYOUT_CURRENCIES.
 */
test('disabling a market leaves its currency formattable for historical rows', () => {
  for (const currency of PAYOUT_CURRENCIES) {
    assert.ok(SUPPORTED_CURRENCIES.includes(currency))
  }
  assert.ok(
    SUPPORTED_CURRENCIES.length > PAYOUT_CURRENCIES.length,
    'a currency that is no longer a market must still be a currency',
  )
})

/**
 * An account saved before the market was disabled still renders: the country
 * falls back to its raw code rather than throwing or reading as blank, so the
 * row stays recognisable to the person who saved it.
 */
test('disabling a market: an existing account still displays its country', () => {
  assert.equal(countryDisplayName(DISABLED), DISABLED)
})
