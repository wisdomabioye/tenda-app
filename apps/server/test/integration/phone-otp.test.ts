/**
 * #98 gap-fill — phone-OTP onboarding routes (console sender in test, no
 * external SMS; gas-seed dispatch is a no-op without a seed key):
 *   POST /v1/auth/send-phone-otp   (422, 409 already-verified, 202 send)
 *   POST /v1/auth/verify-phone-otp (422, 409 taken, wrong-code rejection)
 *
 * Real app via fastify.inject; gated on TEST_DATABASE_URL.
 */
import { test } from 'node:test'
import assert from 'node:assert'
import { eq } from 'drizzle-orm'
import { users } from '@tenda/shared/db/schema/identity'
import { TEST_DB_CONFIGURED, useTestApp, createUser, authHeader } from '../helpers/test-app'

const skip = !TEST_DB_CONFIGURED
const getApp = useTestApp()

let phoneSeq = 7000
const nextPhone = () => `+23480${String(phoneSeq++).padStart(8, '0')}`

// ---------- send-phone-otp -------------------------------------------------------

test('send-phone-otp: 422 when phone_e164 is missing', { skip }, async () => {
  const app = getApp()
  const u = await createUser(app)
  const res = await app.inject({
    method: 'POST', url: '/v1/auth/send-phone-otp', headers: authHeader(u.token), payload: {},
  })
  assert.strictEqual(res.statusCode, 422)
})

test('send-phone-otp: 409 when the phone is already verified', { skip }, async () => {
  const app = getApp()
  const u = await createUser(app)
  await app.db.update(users).set({ phone_verified_at: new Date() }).where(eq(users.id, u.row.id))
  const res = await app.inject({
    method: 'POST', url: '/v1/auth/send-phone-otp', headers: authHeader(u.token),
    payload: { phone_e164: nextPhone() },
  })
  assert.strictEqual(res.statusCode, 409)
  assert.strictEqual(res.json().code, 'PHONE_ALREADY_VERIFIED')
})

test('send-phone-otp: 202 starts verification (console sender stores the code)', { skip }, async () => {
  const app = getApp()
  const u = await createUser(app)
  const res = await app.inject({
    method: 'POST', url: '/v1/auth/send-phone-otp', headers: authHeader(u.token),
    payload: { phone_e164: nextPhone() },
  })
  assert.strictEqual(res.statusCode, 202)
})

// ---------- verify-phone-otp -----------------------------------------------------

test('verify-phone-otp: 422 when fields are missing', { skip }, async () => {
  const app = getApp()
  const u = await createUser(app)
  const res = await app.inject({
    method: 'POST', url: '/v1/auth/verify-phone-otp', headers: authHeader(u.token),
    payload: { phone_e164: nextPhone() },
  })
  assert.strictEqual(res.statusCode, 422)
})

test('verify-phone-otp: 409 when another account already verified the phone', { skip }, async () => {
  const app = getApp()
  const phone = nextPhone()
  const owner = await createUser(app)
  await app.db.update(users).set({ phone_e164: phone, phone_verified_at: new Date() }).where(eq(users.id, owner.row.id))
  const other = await createUser(app)
  const res = await app.inject({
    method: 'POST', url: '/v1/auth/verify-phone-otp', headers: authHeader(other.token),
    payload: { phone_e164: phone, code: '123456' },
  })
  assert.strictEqual(res.statusCode, 409)
})

test('verify-phone-otp: a wrong / unsent code is rejected (4xx, not verified)', { skip }, async () => {
  const app = getApp()
  const u = await createUser(app)
  const phone = nextPhone()
  await app.inject({
    method: 'POST', url: '/v1/auth/send-phone-otp', headers: authHeader(u.token), payload: { phone_e164: phone },
  })
  const res = await app.inject({
    method: 'POST', url: '/v1/auth/verify-phone-otp', headers: authHeader(u.token),
    payload: { phone_e164: phone, code: '000000' },
  })
  assert.ok(res.statusCode >= 400 && res.statusCode < 500, `expected 4xx, got ${res.statusCode}`)
  const [row] = await app.db.select({ v: users.phone_verified_at }).from(users).where(eq(users.id, u.row.id))
  assert.strictEqual(row?.v, null, 'phone must not be marked verified on a wrong code')
})
