/**
 * lib/otp — issue/verify with every policy branch: rate limits (per-phone,
 * per-user), expiry, attempt cap, single-use, hash round-trip.
 */

import { test } from 'node:test'
import * as assert from 'node:assert'
import { AppError } from '@server/lib/errors'
import {
  OTP_MAX_ATTEMPTS,
  OTP_MAX_SENDS_PER_PHONE_PER_HOUR,
  OTP_MAX_SENDS_PER_USER_PER_DAY,
  OTP_TTL_SECONDS,
  hashOtpCode,
  isE164,
  sendPhoneOtp,
  verifyOtpHash,
  verifyPhoneOtp,
  type OtpDeps,
  type OtpStore,
} from '@server/lib/otp'

const NOW = new Date('2026-06-04T12:00:00Z')
const PHONE = '+2348012345678'

interface StoredOtp {
  id: string
  phone_e164: string
  user_id: string | null
  code_hash: string
  expires_at: Date
  attempts: number
  consumed_at: Date | null
  created_at: Date
}

function makeDeps(opts: { now?: Date } = {}): {
  deps: OtpDeps
  rows: StoredOtp[]
  sent: Array<{ phone: string; code: string }>
} {
  const rows: StoredOtp[] = []
  const sent: Array<{ phone: string; code: string }> = []
  let seq = 0
  const store: OtpStore = {
    async countRecentByPhone(phone, since) {
      return rows.filter((r) => r.phone_e164 === phone && r.created_at >= since).length
    },
    async countRecentByUser(user_id, since) {
      return rows.filter((r) => r.user_id === user_id && r.created_at >= since).length
    },
    async insert(row) {
      rows.push({
        ...row,
        id: `otp-${(seq += 1)}`,
        attempts: 0,
        consumed_at: null,
        created_at: opts.now ?? NOW,
      })
    },
    async findActive(phone, user_id) {
      const active = rows
        .filter((r) => r.phone_e164 === phone && r.user_id === user_id && r.consumed_at === null)
        .sort((a, b) => b.created_at.getTime() - a.created_at.getTime())[0]
      return active ?? null
    },
    async recordAttempt(id) {
      const row = rows.find((r) => r.id === id)
      if (row) row.attempts += 1
    },
    async consume(id) {
      const row = rows.find((r) => r.id === id)
      if (row) row.consumed_at = opts.now ?? NOW
    },
  }
  const deps: OtpDeps = {
    store,
    sender: {
      async send(phone, code) {
        sent.push({ phone, code })
      },
    },
    now: () => opts.now ?? NOW,
  }
  return { deps, rows, sent }
}

async function expectCode(p: Promise<unknown>, code: string): Promise<void> {
  await p.then(
    () => assert.fail(`expected ${code}`),
    (e) => {
      assert.ok(e instanceof AppError, `expected AppError, got ${e}`)
      assert.strictEqual(e.code, code)
    },
  )
}

test('hashOtpCode/verifyOtpHash round-trip; wrong code and garbage fail', () => {
  const stored = hashOtpCode('123456')
  assert.strictEqual(verifyOtpHash('123456', stored), true)
  assert.strictEqual(verifyOtpHash('123457', stored), false)
  assert.strictEqual(verifyOtpHash('123456', 'not-a-hash'), false)
})

test('isE164 accepts international formats, rejects local/garbage', () => {
  assert.strictEqual(isE164('+2348012345678'), true)
  assert.strictEqual(isE164('+14155550123'), true)
  assert.strictEqual(isE164('08012345678'), false)
  assert.strictEqual(isE164('+0123'), false)
  assert.strictEqual(isE164(12345), false)
})

test('send issues a 6-digit code with the policy TTL and delivers it', async () => {
  const { deps, rows, sent } = makeDeps()
  const r = await sendPhoneOtp(deps, { phone_e164: PHONE, user_id: 'u-1' })
  assert.strictEqual(r.expires_in, OTP_TTL_SECONDS)
  assert.strictEqual(sent.length, 1)
  assert.match(sent[0].code, /^\d{6}$/)
  assert.strictEqual(rows[0].expires_at.getTime(), NOW.getTime() + OTP_TTL_SECONDS * 1000)
  // Code is stored hashed, never plaintext.
  assert.ok(!rows[0].code_hash.includes(sent[0].code))
})

test('send rejects malformed phone', async () => {
  const { deps } = makeDeps()
  await expectCode(sendPhoneOtp(deps, { phone_e164: 'nope', user_id: 'u-1' }), 'VALIDATION_ERROR')
})

test('per-phone hourly limit blocks the 4th send', async () => {
  const { deps } = makeDeps()
  for (let i = 0; i < OTP_MAX_SENDS_PER_PHONE_PER_HOUR; i += 1) {
    await sendPhoneOtp(deps, { phone_e164: PHONE, user_id: `u-${i}` })
  }
  await expectCode(sendPhoneOtp(deps, { phone_e164: PHONE, user_id: 'u-x' }), 'OTP_RATE_LIMITED')
})

test('per-user daily limit blocks the 11th send across phones', async () => {
  const { deps } = makeDeps()
  for (let i = 0; i < OTP_MAX_SENDS_PER_USER_PER_DAY; i += 1) {
    await sendPhoneOtp(deps, { phone_e164: `+23480123456${String(i).padStart(2, '0')}`, user_id: 'u-1' })
  }
  await expectCode(
    sendPhoneOtp(deps, { phone_e164: '+2348099999999', user_id: 'u-1' }),
    'OTP_RATE_LIMITED',
  )
})

test('verify consumes a correct code; the same code cannot be reused', async () => {
  const { deps, sent } = makeDeps()
  await sendPhoneOtp(deps, { phone_e164: PHONE, user_id: 'u-1' })
  await verifyPhoneOtp(deps, { phone_e164: PHONE, code: sent[0].code, user_id: 'u-1' })
  await expectCode(verifyPhoneOtp(deps, { phone_e164: PHONE, code: sent[0].code, user_id: 'u-1' }), 'OTP_INVALID')
})

test('verify rejects when no active code exists', async () => {
  const { deps } = makeDeps()
  await expectCode(verifyPhoneOtp(deps, { phone_e164: PHONE, code: '000000', user_id: 'u-1' }), 'OTP_INVALID')
})

test('verify rejects an expired code', async () => {
  const { deps, sent } = makeDeps()
  await sendPhoneOtp(deps, { phone_e164: PHONE, user_id: 'u-1' })
  const late = { ...deps, now: () => new Date(NOW.getTime() + (OTP_TTL_SECONDS + 1) * 1000) }
  await expectCode(verifyPhoneOtp(late, { phone_e164: PHONE, code: sent[0].code, user_id: 'u-1' }), 'OTP_EXPIRED')
})

test('5 wrong attempts invalidate the OTP even with the right code after', async () => {
  const { deps, sent } = makeDeps()
  await sendPhoneOtp(deps, { phone_e164: PHONE, user_id: 'u-1' })
  const wrong = sent[0].code === '000000' ? '111111' : '000000'
  for (let i = 0; i < OTP_MAX_ATTEMPTS; i += 1) {
    await expectCode(verifyPhoneOtp(deps, { phone_e164: PHONE, code: wrong, user_id: 'u-1' }), 'OTP_INVALID')
  }
  // 6th try with the CORRECT code still refused — attempts exhausted.
  await expectCode(verifyPhoneOtp(deps, { phone_e164: PHONE, code: sent[0].code, user_id: 'u-1' }), 'OTP_INVALID')
})

test('a code issued to one user cannot be consumed by another account', async () => {
  const { deps, sent } = makeDeps()
  await sendPhoneOtp(deps, { phone_e164: PHONE, user_id: 'u-1' })
  await expectCode(
    verifyPhoneOtp(deps, { phone_e164: PHONE, code: sent[0].code, user_id: 'u-2' }),
    'OTP_INVALID',
  )
  // The rightful requester still verifies fine afterwards.
  await verifyPhoneOtp(deps, { phone_e164: PHONE, code: sent[0].code, user_id: 'u-1' })
})
