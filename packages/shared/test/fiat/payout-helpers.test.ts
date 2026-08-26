import { test } from 'node:test'
import assert from 'node:assert/strict'
import { requireIban } from '../../src/fiat/payout/helpers'

/**
 * `requireIban` implements the ISO 13616 mod-97 check by reducing digit by
 * digit, because the expanded numeric form of an IBAN is up to 36 digits — far
 * past Number.MAX_SAFE_INTEGER, so a single `%` on a parsed number would
 * silently return the wrong remainder for some inputs and the right one for
 * others.
 *
 * That makes the implementation worth checking against something other than
 * itself, so these tests compare it to a BigInt oracle over real published
 * IBANs and a deterministic sweep of generated ones.
 */

/** Independent implementation: expand fully, then one BigInt modulo. */
function oracleMod97(iban: string): number {
  const rearranged = iban.slice(4) + iban.slice(0, 4)
  let expanded = ''
  for (const c of rearranged) {
    expanded += c >= 'A' && c <= 'Z' ? String(c.charCodeAt(0) - 55) : c
  }
  return Number(BigInt(expanded) % 97n)
}

const accepts = (iban: string) =>
  requireIban(iban, 'IBAN', { country: iban.slice(0, 2), length: iban.length }) === null

/**
 * Real published examples. GB/DE/FR/SA matter specifically because they carry
 * LETTERS inside the account part, which is the branch that maps A–Z to 10–35;
 * an AE-only fixture set would never execute it.
 */
const REAL_IBANS = [
  'AE070331234567890123456',
  'AE460090000000123456789',
  'GB82WEST12345698765432',
  'DE89370400440532013000',
  'FR1420041010050500013M02606',
  'SA0380000000608010167519',
]

test('accepts real published IBANs, including ones with letters in the account part', () => {
  for (const iban of REAL_IBANS) {
    assert.equal(oracleMod97(iban), 1, `${iban} should be checksum-valid`)
    assert.ok(accepts(iban), `${iban} was rejected`)
  }
})

/**
 * Deterministic sweep — a seeded generator rather than Math.random, so a
 * failure names an input someone can reproduce instead of a run they cannot.
 */
test('agrees with a BigInt oracle across a deterministic sweep', () => {
  let seed = 20260826
  const nextDigit = () => {
    seed = (seed * 1103515245 + 12345) % 2147483648
    return String(seed % 10)
  }

  let checksumValid = 0
  for (let i = 0; i < 500; i++) {
    let iban = 'AE'
    for (let j = 0; j < 21; j++) iban += nextDigit()
    const expected = oracleMod97(iban) === 1
    assert.equal(accepts(iban), expected, `disagreed with the oracle on ${iban}`)
    if (expected) checksumValid++
  }
  // Roughly 1 in 97 random strings check out; a sweep that found none would
  // mean only the rejecting path was ever exercised.
  assert.ok(checksumValid > 0, 'the sweep never produced a valid IBAN')
})

test('rejects on country, length and character set before the checksum', () => {
  const valid = 'AE070331234567890123456'
  assert.match(requireIban('', 'IBAN', { country: 'AE', length: 23 }) ?? '', /required/)
  assert.match(requireIban(valid, 'IBAN', { country: 'GB', length: 23 }) ?? '', /start with GB/)
  assert.match(requireIban(valid, 'IBAN', { country: 'AE', length: 22 }) ?? '', /22 characters/)
  assert.match(
    requireIban('AE07033123456789012345!', 'IBAN', { country: 'AE', length: 23 }) ?? '',
    /letters and digits only/,
  )
})

test('normalises spacing and case before validating', () => {
  for (const form of [
    'AE07 0331 2345 6789 0123 456',
    'ae070331234567890123456',
    '  AE070331234567890123456  ',
  ]) {
    assert.equal(requireIban(form, 'IBAN', { country: 'AE', length: 23 }), null, `rejected ${form}`)
  }
})
