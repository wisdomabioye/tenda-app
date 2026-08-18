/**
 * The gig composer's cross-client validation contract (moved from mobile's
 * gig-composer.steps test): first actionable requirement per step, the
 * remote-location exemption, and the whole-form recheck before submission.
 */
import { test } from 'node:test'
import assert from 'node:assert'
import { MAX_COMPLETION_DURATION_SECONDS } from '../../src/utils/validation'
import {
  getGigMissingRequirement,
  getGigStepMissingRequirement,
} from '../../src/constants/gig-composer'

const VALID = {
  title: 'Deliver a package',
  description: 'Collect and safely deliver the parcel.',
  category: 'delivery' as const,
  remote: false,
  country: 'NG',
  city: 'Lagos',
  asset: 'USDC_SOL',
  paymentRaw: '10000000',
  completionDuration: 86_400,
}

test('reports the first actionable details requirement', () => {
  assert.strictEqual(getGigStepMissingRequirement('details', { ...VALID, category: null }), 'Pick a category')
  assert.strictEqual(getGigStepMissingRequirement('details', { ...VALID, title: ' ' }), 'Add a title')
  assert.strictEqual(getGigStepMissingRequirement('details', { ...VALID, description: '' }), 'Add a description')
  assert.strictEqual(getGigStepMissingRequirement('details', { ...VALID, country: null }), 'Select a country')
  assert.strictEqual(getGigStepMissingRequirement('details', { ...VALID, city: null }), 'Select a city')
})

test('does not require a location for remote work', () => {
  assert.strictEqual(
    getGigStepMissingRequirement('details', { ...VALID, remote: true, country: null, city: null }),
    null,
  )
})

test('validates payment independently from details', () => {
  assert.strictEqual(getGigStepMissingRequirement('payment', { ...VALID, paymentRaw: '' }), 'Set a budget')
  assert.strictEqual(
    getGigStepMissingRequirement('payment', { ...VALID, completionDuration: 1 }),
    'Set a delivery time',
  )
  assert.strictEqual(
    getGigStepMissingRequirement('payment', {
      ...VALID,
      completionDuration: MAX_COMPLETION_DURATION_SECONDS + 1,
    }),
    'Set a delivery time',
  )
  assert.strictEqual(getGigStepMissingRequirement('payment', VALID), null)
})

test('rechecks the complete form before final submission', () => {
  assert.strictEqual(getGigMissingRequirement(VALID), null)
  assert.strictEqual(getGigMissingRequirement({ ...VALID, title: '' }), 'Add a title')
  assert.strictEqual(getGigMissingRequirement({ ...VALID, paymentRaw: '' }), 'Set a budget')
})
