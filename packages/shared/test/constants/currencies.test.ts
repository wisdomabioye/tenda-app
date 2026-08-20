import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  SUPPORTED_CURRENCIES,
  CURRENCY_META,
  DEFAULT_CURRENCY,
  isSupportedCurrency,
} from '../../src/constants/currencies'

test('SUPPORTED_CURRENCIES: non-empty and duplicate-free', () => {
  assert.ok(SUPPORTED_CURRENCIES.length > 0)
  assert.equal(new Set(SUPPORTED_CURRENCIES).size, SUPPORTED_CURRENCIES.length)
})

test('CURRENCY_META: one complete entry per supported currency, no extras', () => {
  assert.deepEqual(Object.keys(CURRENCY_META).sort(), [...SUPPORTED_CURRENCIES].sort())
  for (const code of SUPPORTED_CURRENCIES) {
    const meta = CURRENCY_META[code]
    assert.ok(meta.symbol.length > 0, `${code} symbol`)
    assert.ok(meta.name.length > 0, `${code} name`)
    assert.ok(meta.flag.length > 0, `${code} flag`)
    assert.match(meta.locale, /^[a-z]{2}-[A-Z]{2}$/, `${code} locale`)
    assert.equal(meta.coingeckoKey, code.toLowerCase(), `${code} coingeckoKey is the lowercased code`)
  }
})

test('DEFAULT_CURRENCY is itself a supported currency', () => {
  // The invariant that makes the default safe to fall back TO. A default
  // outside the vocabulary would index CURRENCY_META to undefined and throw on
  // the next property read — the exact failure it exists to prevent (#88).
  assert.ok(isSupportedCurrency(DEFAULT_CURRENCY))
  assert.ok(CURRENCY_META[DEFAULT_CURRENCY] !== undefined)
})

test('isSupportedCurrency admits every listed code', () => {
  // Derived from the vocabulary rather than spot-checked, so a currency added
  // tomorrow is covered without anyone remembering to come back.
  for (const code of SUPPORTED_CURRENCIES) {
    assert.ok(isSupportedCurrency(code), code)
  }
})

test('isSupportedCurrency refuses anything else, whatever its type', () => {
  // The callers are boundaries — parsed JSON out of device storage, a payload —
  // so the values it must refuse are not all strings.
  for (const value of ['XXX', 'ngn', '', ' NGN', null, undefined, 42, {}, ['NGN'], true]) {
    assert.equal(isSupportedCurrency(value), false, JSON.stringify(value) ?? 'undefined')
  }
})
