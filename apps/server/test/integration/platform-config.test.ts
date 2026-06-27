/**
 * Admin platform-config validation caps. The fee/grace maxima are sourced from
 * ESCROW_LIMITS (guarded == both contracts by check-contract-parity), so the
 * off-chain config can't accept a value the chain would revert. These cases
 * lock the tightened bounds: an over-limit value must 400 BEFORE the DB write
 * (so they hold regardless of whether platform_config is seeded), and the
 * boundary value must pass validation (not a range 400).
 *
 * Real app via fastify.inject; gated on TEST_DATABASE_URL.
 */
import { test } from 'node:test'
import assert from 'node:assert'
import { ESCROW_LIMITS } from '@tenda/shared'
import { TEST_DB_CONFIGURED, useTestApp, createUser, authHeader } from '../helpers/test-app'

const skip = !TEST_DB_CONFIGURED
const getApp = useTestApp()
const { maxPlatformFeeBps, maxGracePeriodSeconds } = ESCROW_LIMITS

type PatchBody = { fee_bps?: number; seeker_fee_bps?: number; grace_period_seconds?: number }

async function patch(app: ReturnType<typeof getApp>, token: string, payload: PatchBody) {
  return app.inject({ method: 'PATCH', url: '/v1/admin/platform-config', headers: authHeader(token), payload })
}

test('rejects fee_bps above the on-chain MAX_PLATFORM_FEE_BPS', { skip }, async () => {
  const app = getApp()
  const admin = await createUser(app, { role: 'super_admin' })
  for (const fee_bps of [maxPlatformFeeBps + 1, 10_000]) {
    const res = await patch(app, admin.token, { fee_bps })
    assert.strictEqual(res.statusCode, 400, `fee_bps=${fee_bps} → ${res.statusCode}`)
    assert.strictEqual(res.json().code, 'VALIDATION_ERROR')
  }
})

test('rejects seeker_fee_bps above the cap', { skip }, async () => {
  const app = getApp()
  const admin = await createUser(app, { role: 'super_admin' })
  const res = await patch(app, admin.token, { seeker_fee_bps: maxPlatformFeeBps + 1 })
  assert.strictEqual(res.statusCode, 400)
  assert.strictEqual(res.json().code, 'VALIDATION_ERROR')
})

test('rejects grace_period_seconds above the on-chain MAX_GRACE_PERIOD_SECONDS', { skip }, async () => {
  const app = getApp()
  const admin = await createUser(app, { role: 'super_admin' })
  // One second over the 14-day on-chain cap (was previously accepted up to 30d).
  const res = await patch(app, admin.token, { grace_period_seconds: maxGracePeriodSeconds + 1 })
  assert.strictEqual(res.statusCode, 400, `grace=${maxGracePeriodSeconds + 1} → ${res.statusCode}`)
  assert.strictEqual(res.json().code, 'VALIDATION_ERROR')
})

test('rejects negative / non-integer values', { skip }, async () => {
  const app = getApp()
  const admin = await createUser(app, { role: 'super_admin' })
  for (const payload of [{ fee_bps: -1 }, { fee_bps: 1.5 }, { grace_period_seconds: -1 }]) {
    const res = await patch(app, admin.token, payload)
    assert.strictEqual(res.statusCode, 400, `${JSON.stringify(payload)} → ${res.statusCode}`)
  }
})

test('boundary values pass validation (not a range 400)', { skip }, async () => {
  const app = getApp()
  const admin = await createUser(app, { role: 'super_admin' })
  // At the cap exactly: validation must accept it. The write may 200 (seeded)
  // or 404 (unseeded row) — both prove validation did not reject the value.
  for (const payload of [{ fee_bps: maxPlatformFeeBps }, { grace_period_seconds: maxGracePeriodSeconds }]) {
    const res = await patch(app, admin.token, payload)
    assert.notStrictEqual(res.statusCode, 400, `${JSON.stringify(payload)} → ${res.statusCode}`)
  }
})
