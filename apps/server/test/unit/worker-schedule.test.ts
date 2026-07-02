/**
 * Pins the periodic schedule (plugins/workers.ts REPEATABLES). A repeatable
 * handler once shipped fully unit-tested but unscheduled (the stage-6
 * price-stats rollup): the parts were green, nothing asserted the
 * composition. This test makes "implemented a periodic job" and "scheduled
 * it" fail together or pass together. Pure module import — no Redis/DB.
 */
import { test } from 'node:test'
import assert from 'node:assert'
import { REPEATABLES } from '@server/plugins/workers'

const byName = new Map(REPEATABLES.map((r) => [r.name as string, r]))

test('the schedule contains exactly the known periodic jobs, each once', () => {
  const expected = [
    'expire-escrows',
    'expire-fiat-quotes',
    'reconcile',
    'reconcile-fiat',
    'update-price-stats',
  ]
  assert.deepStrictEqual([...byName.keys()].sort(), expected)
  assert.strictEqual(REPEATABLES.length, byName.size, 'duplicate repeatable names')
})

test('cadences: expiries every 60s, reconciles every 5min, price stats nightly', () => {
  assert.strictEqual(byName.get('expire-escrows')?.every_ms, 60_000)
  assert.strictEqual(byName.get('expire-fiat-quotes')?.every_ms, 60_000)
  assert.strictEqual(byName.get('reconcile')?.every_ms, 5 * 60_000)
  assert.strictEqual(byName.get('reconcile-fiat')?.every_ms, 5 * 60_000)
  assert.strictEqual(byName.get('update-price-stats')?.every_ms, 24 * 3_600_000)
})

test('every repeatable has a positive interval and an object payload', () => {
  for (const r of REPEATABLES) {
    assert.ok(r.every_ms > 0, `${r.name}: non-positive interval`)
    assert.strictEqual(typeof r.payload, 'object', `${r.name}: payload must be an object`)
  }
})
