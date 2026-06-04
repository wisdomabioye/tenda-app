/**
 * lib/gig-details — validation matrix for the gig create-detail body
 * (POST /v1/gigs). Positive + negative cases per field; country/cross-
 * border resolution against the creator's stored country.
 */

import { test } from 'node:test'
import * as assert from 'node:assert'
import { MAX_GIG_TITLE_LENGTH, MAX_GIG_DESCRIPTION_LENGTH } from '@tenda/shared'
import type { CreateGigDetailsBody } from '@tenda/shared'
import { validateGigDetails } from '@server/lib/gig-details'
import { AppError } from '@server/lib/errors'

function body(overrides: Partial<CreateGigDetailsBody> = {}): Partial<CreateGigDetailsBody> {
  return {
    escrow_id: 'e-1',
    title: 'Fix my fence',
    description: 'Wood panels',
    category: 'service' as CreateGigDetailsBody['category'],
    country: 'NG',
    remote: false,
    city: 'Lagos',
    ...overrides,
  }
}

function expect400(input: Partial<CreateGigDetailsBody>, creatorCountry: string | null, match: RegExp) {
  assert.throws(
    () => validateGigDetails(input, creatorCountry),
    (err: unknown) => err instanceof AppError && err.statusCode === 400 && match.test(err.message),
  )
}

test('happy path: trims text, keeps city, computes cross_border=false for same country', () => {
  const v = validateGigDetails(body({ title: '  Fix my fence  ' }), 'NG')
  assert.strictEqual(v.title, 'Fix my fence')
  assert.strictEqual(v.city, 'Lagos')
  assert.strictEqual(v.country, 'NG')
  assert.strictEqual(v.remote, false)
  assert.strictEqual(v.cross_border, false)
})

test('remote gig: country falls back to the creator country; city nulled', () => {
  const v = validateGigDetails(body({ remote: true, country: undefined, city: undefined }), 'NG')
  assert.strictEqual(v.country, 'NG')
  assert.strictEqual(v.city, null)
})

test('empty description normalises to null', () => {
  const v = validateGigDetails(body({ description: '   ' }), 'NG')
  assert.strictEqual(v.description, null)
})

test('title: required + max length', () => {
  expect400(body({ title: '' }), 'NG', /title is required/)
  expect400(body({ title: '   ' }), 'NG', /title is required/)
  expect400(body({ title: 'x'.repeat(MAX_GIG_TITLE_LENGTH + 1) }), 'NG', /at most/)
})

test('description: max length', () => {
  expect400(body({ description: 'x'.repeat(MAX_GIG_DESCRIPTION_LENGTH + 1) }), 'NG', /at most/)
})

test('category: must be a known category', () => {
  expect400(body({ category: 'not-a-category' as CreateGigDetailsBody['category'] }), 'NG', /category must be one of/)
})

test('non-remote: city and country required', () => {
  expect400(body({ city: undefined }), 'NG', /city is required/)
  expect400(body({ country: undefined }), 'NG', /country is required/)
})

test('country must exist in LOCATIONS (incl. remote fallback misses)', () => {
  expect400(body({ country: 'ZZ' }), 'NG', /country must be one of/)
  // Remote with no body country and no creator country → unresolvable.
  expect400(body({ remote: true, country: undefined }), null, /country must be one of/)
})

test('city must belong to the provided country', () => {
  expect400(body({ city: 'Nairobi' }), 'NG', /is not in country/)
})

test('coordinates validated when present', () => {
  expect400(body({ latitude: 91, longitude: 3.4 }), 'NG', /atitude|oordinate/)
})

test('cross_border: true when non-remote gig country differs from creator country', () => {
  const v = validateGigDetails(body(), 'KE')
  assert.strictEqual(v.cross_border, true)
})
