import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  PAYOUT_COUNTRY_SPECS,
  SUPPORTED_PAYOUT_COUNTRIES,
  PAYOUT_CURRENCIES,
  GH_MOMO_NETWORKS,
  getPayoutSpec,
  getPayoutRail,
} from '../../src/fiat/payout'
import { SUPPORTED_CURRENCIES } from '../../src/constants/currencies'

// ---------- registry shape -------------------------------------------------

test('launch countries are exactly NG, KE, GH', () => {
  assert.deepEqual(new Set(SUPPORTED_PAYOUT_COUNTRIES), new Set(['NG', 'KE', 'GH']))
})

test('PAYOUT_CURRENCIES is derived, deduped, and a subset of SUPPORTED_CURRENCIES', () => {
  assert.deepEqual(new Set(PAYOUT_CURRENCIES), new Set(['NGN', 'KES', 'GHS']))
  for (const c of PAYOUT_CURRENCIES) {
    assert.ok(SUPPORTED_CURRENCIES.includes(c), `${c} must be a supported currency`)
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

test('getPayoutSpec / getPayoutRail resolve and reject correctly', () => {
  assert.equal(getPayoutSpec('NG')?.currency, 'NGN')
  assert.equal(getPayoutSpec('US'), null)
  assert.ok(getPayoutRail('GH', 'mobile_money') !== null)
  assert.equal(getPayoutRail('NG', 'mobile_money'), null, 'NG has no MoMo rail')
  assert.equal(getPayoutRail('ZZ', 'bank'), null)
})

// ---------- NG (NUBAN bank) -------------------------------------------------

const ngBank = getPayoutRail('NG', 'bank')!

test('NG bank: a valid NUBAN account passes', () => {
  assert.equal(ngBank.validate({ bank_code: '058', account_number: '0123456789', account_name: 'ADAEZE OKOYE' }), null)
})

test('NG bank: rejects a non-10-digit account, blank name, non-numeric code', () => {
  assert.match(ngBank.validate({ bank_code: '058', account_number: '012345678', account_name: 'A' }) ?? '', /Account number/)
  assert.match(ngBank.validate({ bank_code: '058', account_number: '0123456789', account_name: '  ' }) ?? '', /Account name/)
  assert.match(ngBank.validate({ bank_code: 'GTB', account_number: '0123456789', account_name: 'A' }) ?? '', /Bank \(NIP\) code/)
})

test('NG bank: masks all but the last 4 digits', () => {
  assert.equal(ngBank.maskAccountNumber('0123456789'), '•••••• 6789')
})

// ---------- KE (bank) -------------------------------------------------------

const keBank = getPayoutRail('KE', 'bank')!

test('KE bank: valid passes; too-short account rejected', () => {
  assert.equal(keBank.validate({ bank_code: 'Equity Bank', account_number: '01234567', account_name: 'WANJIKU' }), null)
  assert.match(keBank.validate({ bank_code: 'Equity', account_number: '123', account_name: 'W' }) ?? '', /Account number/)
  assert.match(keBank.validate({ bank_code: '', account_number: '01234567', account_name: 'W' }) ?? '', /Bank name/)
})

// ---------- GH (bank + MoMo) ------------------------------------------------

const ghBank = getPayoutRail('GH', 'bank')!
const ghMomo = getPayoutRail('GH', 'mobile_money')!

test('GH bank: valid passes; out-of-range account rejected', () => {
  assert.equal(ghBank.validate({ bank_code: 'GCB Bank', account_number: '12345678901', account_name: 'KWAME' }), null)
  assert.match(ghBank.validate({ bank_code: 'GCB', account_number: '123', account_name: 'K' }) ?? '', /Account number/)
})

test('GH MoMo: valid MTN number passes', () => {
  assert.equal(ghMomo.validate({ bank_code: 'MTN', account_number: '0241234567', account_name: 'KWAME MENSAH' }), null)
})

test('GH MoMo: rejects unknown network, non-10-digit and non-leading-0 numbers', () => {
  assert.match(ghMomo.validate({ bank_code: 'PAYPAL', account_number: '0241234567', account_name: 'K' }) ?? '', /Network/)
  assert.match(ghMomo.validate({ bank_code: 'MTN', account_number: '24123456', account_name: 'K' }) ?? '', /Mobile number/)
  assert.match(ghMomo.validate({ bank_code: 'MTN', account_number: '1241234567', account_name: 'K' }) ?? '', /start with 0/)
  assert.match(ghMomo.validate({ bank_code: 'MTN', account_number: '024123456X', account_name: 'K' }) ?? '', /digits only/)
})

test('GH MoMo: networks are the three live GH providers; number masks to last 3', () => {
  assert.deepEqual(GH_MOMO_NETWORKS.map((n) => n.value), ['MTN', 'TELECEL', 'AIRTELTIGO'])
  assert.equal(ghMomo.maskAccountNumber('0241234567'), '••••••• 567')
})

test('every rail rejects a fully-empty input', () => {
  for (const spec of Object.values(PAYOUT_COUNTRY_SPECS)) {
    for (const rail of spec.rails) {
      const err = rail.validate({ bank_code: '', account_number: '', account_name: '' })
      assert.ok(typeof err === 'string' && err.length > 0, `${spec.country}/${rail.kind} must reject empty`)
    }
  }
})
