/**
 * Phone-OTP onboarding routes (Stage 9: phone lives in `user_identities`;
 * console sender in test, gas-seed a no-op without a seed key):
 *   POST /v1/auth/send-phone-otp   (422, 409 already-verified, 202 send)
 *   POST /v1/auth/verify-phone-otp (422, 409 owned-by-another, wrong-code)
 *
 * Real app via fastify.inject; gated on TEST_DATABASE_URL.
 */
import { test } from 'node:test'
import assert from 'node:assert'
import { and, eq } from 'drizzle-orm'
import { auth_otps, user_identities } from '@tenda/shared/db/schema'
import { hashOtpCode } from '@server/lib/otp'
import { TEST_DB_CONFIGURED, useTestApp, createUser, authHeader } from '../helpers/test-app'

const skip = !TEST_DB_CONFIGURED
const getApp = useTestApp()

let phoneSeq = 7000
const nextPhone = () => `+23480${String(phoneSeq++).padStart(8, '0')}`

type App = ReturnType<typeof getApp>

/** Insert a VERIFIED phone identity (the new home of phone_verified_at). */
async function verifyPhoneFor(app: App, userId: string, phone: string): Promise<void> {
  await app.db.insert(user_identities).values({
    user_id: userId,
    kind: 'phone',
    identifier: phone,
    email: null,
    verified_at: new Date(),
  })
}

/** Seed an unconsumed phone OTP with a known code for (phone, user). */
async function seedOtp(app: App, phone: string, userId: string, code = '123456'): Promise<void> {
  await app.db.insert(auth_otps).values({
    channel: 'phone',
    identifier: phone,
    user_id: userId,
    code_hash: hashOtpCode(code),
    expires_at: new Date(Date.now() + 10 * 60_000),
  })
}

async function phoneIdentityCount(app: App, userId: string): Promise<number> {
  const rows = await app.db
    .select({ id: user_identities.id })
    .from(user_identities)
    .where(and(eq(user_identities.user_id, userId), eq(user_identities.kind, 'phone')))
  return rows.length
}

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
  await verifyPhoneFor(app, u.row.id, nextPhone())
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

test('verify-phone-otp: 200 attaches a verified phone identity', { skip }, async () => {
  const app = getApp()
  const u = await createUser(app)
  const phone = nextPhone()
  await seedOtp(app, phone, u.row.id)
  const res = await app.inject({
    method: 'POST', url: '/v1/auth/verify-phone-otp', headers: authHeader(u.token),
    payload: { phone_e164: phone, code: '123456' },
  })
  assert.strictEqual(res.statusCode, 200)
  assert.strictEqual(res.json().verified, true)
  assert.strictEqual(await phoneIdentityCount(app, u.row.id), 1)
})

test('verify-phone-otp: 409 when another account owns the phone (proven control, no merge)', { skip }, async () => {
  const app = getApp()
  const phone = nextPhone()
  const owner = await createUser(app)
  await verifyPhoneFor(app, owner.row.id, phone)
  // The other account proves control of the same phone, but it is blocked.
  const other = await createUser(app)
  await seedOtp(app, phone, other.row.id)
  const res = await app.inject({
    method: 'POST', url: '/v1/auth/verify-phone-otp', headers: authHeader(other.token),
    payload: { phone_e164: phone, code: '123456' },
  })
  assert.strictEqual(res.statusCode, 409)
  assert.strictEqual(res.json().code, 'IDENTITY_ALREADY_LINKED')
  assert.strictEqual(await phoneIdentityCount(app, other.row.id), 0, 'no identity attached to the loser')
})

test('verify-phone-otp: a wrong / unsent code is rejected and attaches nothing', { skip }, async () => {
  const app = getApp()
  const u = await createUser(app)
  const phone = nextPhone()
  await seedOtp(app, phone, u.row.id)
  const res = await app.inject({
    method: 'POST', url: '/v1/auth/verify-phone-otp', headers: authHeader(u.token),
    payload: { phone_e164: phone, code: '000000' },
  })
  assert.ok(res.statusCode >= 400 && res.statusCode < 500, `expected 4xx, got ${res.statusCode}`)
  assert.strictEqual(await phoneIdentityCount(app, u.row.id), 0, 'phone must not be attached on a wrong code')
})
