/**
 * Phone OTP issue/verify (stage-1-onboarding.md § Server).
 *
 * Rules enforced here (route handlers stay thin):
 *   - send: 3 sends per phone per hour, 10 per user per day (DB-counted —
 *     multi-pod safe, unlike in-memory rate limiting)
 *   - verify: max 5 attempts per OTP, 10-minute expiry, single-use
 *   - codes are 6-digit, hashed with scrypt (node:crypto — no new dep;
 *     equivalent strength to the bcrypt the stage doc suggests)
 *
 * Delivery is behind `OtpSender`: Termii when configured (#32), console
 * logging otherwise (development interim).
 */

import { isE164 } from '@tenda/shared'
import { randomInt, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto'
import { and, eq, gte, isNull, sql } from 'drizzle-orm'
import { phone_otps } from '@tenda/shared/db/schema-v2/identity'
import { ErrorCode } from '@tenda/shared'
import { AppError } from '@server/lib/errors'
import type { AppDatabase } from '@server/plugins/db'

// ---------- policy constants ------------------------------------------------

export const OTP_TTL_SECONDS = 10 * 60
export const OTP_MAX_ATTEMPTS = 5
export const OTP_MAX_SENDS_PER_PHONE_PER_HOUR = 3
export const OTP_MAX_SENDS_PER_USER_PER_DAY = 10
export const OTP_CODE_DIGITS = 6

/** Loose E.164: '+' then 8–15 digits, no leading zero after '+'. */
export { isE164 }

// ---------- code hashing ------------------------------------------------------

const SCRYPT_KEYLEN = 32

export function hashOtpCode(code: string): string {
  const salt = randomBytes(16)
  const hash = scryptSync(code, salt, SCRYPT_KEYLEN)
  return `${salt.toString('hex')}:${hash.toString('hex')}`
}

export function verifyOtpHash(code: string, stored: string): boolean {
  const [saltHex, hashHex] = stored.split(':')
  if (saltHex === undefined || hashHex === undefined) return false
  const expected = Buffer.from(hashHex, 'hex')
  const actual = scryptSync(code, Buffer.from(saltHex, 'hex'), SCRYPT_KEYLEN)
  return expected.length === actual.length && timingSafeEqual(expected, actual)
}

// ---------- sender abstraction -----------------------------------------------

export interface OtpSender {
  send(phone_e164: string, code: string): Promise<void>
}

export const TERMII_SMS_URL = 'https://api.ng.termii.com/api/sms/send'

export function termiiSender(args: { api_key: string; sender_id: string }): OtpSender {
  return {
    async send(phone_e164, code) {
      const res = await fetch(TERMII_SMS_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          api_key: args.api_key,
          to: phone_e164,
          from: args.sender_id,
          sms: `Your Tenda verification code is ${code}. Expires in 10 minutes.`,
          type: 'plain',
          channel: 'generic',
        }),
      })
      if (!res.ok) {
        throw new AppError(
          502,
          ErrorCode.INTERNAL_ERROR,
          `Termii send failed with status ${res.status}`,
        )
      }
    },
  }
}

/** Development interim (#32 unset): code lands in the server log. */
export function consoleSender(log: { warn(obj: object, msg: string): void }): OtpSender {
  return {
    async send(phone_e164, code) {
      log.warn({ phone_e164, code }, 'TERMII_API_KEY unset — OTP code logged, not sent')
    },
  }
}

// ---------- store abstraction --------------------------------------------------

export interface OtpStore {
  countRecentByPhone(phone_e164: string, since: Date): Promise<number>
  countRecentByUser(user_id: string, since: Date): Promise<number>
  insert(row: {
    phone_e164: string
    user_id: string | null
    code_hash: string
    expires_at: Date
  }): Promise<void>
  /**
   * Latest unconsumed OTP for (phone, user), or null. The user binding
   * stops a second authenticated account from consuming a code issued in
   * someone else's session (shared-device edge).
   */
  findActive(
    phone_e164: string,
    user_id: string,
  ): Promise<{
    id: string
    code_hash: string
    expires_at: Date
    attempts: number
  } | null>
  recordAttempt(id: string): Promise<void>
  consume(id: string): Promise<void>
}

export function drizzleOtpStore(db: AppDatabase): OtpStore {
  return {
    async countRecentByPhone(phone_e164, since) {
      const rows = await db
        .select({ n: sql<number>`count(*)::int` })
        .from(phone_otps)
        .where(and(eq(phone_otps.phone_e164, phone_e164), gte(phone_otps.created_at, since)))
      return rows[0]?.n ?? 0
    },
    async countRecentByUser(user_id, since) {
      const rows = await db
        .select({ n: sql<number>`count(*)::int` })
        .from(phone_otps)
        .where(and(eq(phone_otps.user_id, user_id), gte(phone_otps.created_at, since)))
      return rows[0]?.n ?? 0
    },
    async insert(row) {
      await db.insert(phone_otps).values(row)
    },
    async findActive(phone_e164, user_id) {
      const rows = await db
        .select({
          id: phone_otps.id,
          code_hash: phone_otps.code_hash,
          expires_at: phone_otps.expires_at,
          attempts: phone_otps.attempts,
        })
        .from(phone_otps)
        .where(
          and(
            eq(phone_otps.phone_e164, phone_e164),
            eq(phone_otps.user_id, user_id),
            isNull(phone_otps.consumed_at),
          ),
        )
        .orderBy(sql`${phone_otps.created_at} DESC`)
        .limit(1)
      return rows[0] ?? null
    },
    async recordAttempt(id) {
      await db
        .update(phone_otps)
        .set({ attempts: sql`${phone_otps.attempts} + 1` })
        .where(eq(phone_otps.id, id))
    },
    async consume(id) {
      await db.update(phone_otps).set({ consumed_at: new Date() }).where(eq(phone_otps.id, id))
    },
  }
}

// ---------- service ------------------------------------------------------------

export interface OtpDeps {
  store: OtpStore
  sender: OtpSender
  now(): Date
}

export async function sendPhoneOtp(
  deps: OtpDeps,
  input: { phone_e164: string; user_id: string },
): Promise<{ expires_in: number }> {
  if (!isE164(input.phone_e164)) {
    throw new AppError(422, ErrorCode.VALIDATION_ERROR, 'phone must be E.164 (+234…)')
  }
  const now = deps.now()
  const hourAgo = new Date(now.getTime() - 3_600_000)
  const dayAgo = new Date(now.getTime() - 86_400_000)

  const [byPhone, byUser] = await Promise.all([
    deps.store.countRecentByPhone(input.phone_e164, hourAgo),
    deps.store.countRecentByUser(input.user_id, dayAgo),
  ])
  if (byPhone >= OTP_MAX_SENDS_PER_PHONE_PER_HOUR || byUser >= OTP_MAX_SENDS_PER_USER_PER_DAY) {
    throw new AppError(429, ErrorCode.OTP_RATE_LIMITED, 'too many OTP requests — try again later')
  }

  const code = String(randomInt(0, 10 ** OTP_CODE_DIGITS)).padStart(OTP_CODE_DIGITS, '0')
  await deps.store.insert({
    phone_e164: input.phone_e164,
    user_id: input.user_id,
    code_hash: hashOtpCode(code),
    expires_at: new Date(now.getTime() + OTP_TTL_SECONDS * 1000),
  })
  await deps.sender.send(input.phone_e164, code)
  return { expires_in: OTP_TTL_SECONDS }
}

/**
 * Verify a code. Throws OTP_INVALID / OTP_EXPIRED; consuming the OTP on
 * success. The 6th wrong attempt invalidates the OTP (attempts >= max).
 */
export async function verifyPhoneOtp(
  deps: OtpDeps,
  input: { phone_e164: string; code: string; user_id: string },
): Promise<void> {
  const active = await deps.store.findActive(input.phone_e164, input.user_id)
  if (active === null) {
    throw new AppError(401, ErrorCode.OTP_INVALID, 'no active code for this phone')
  }
  if (deps.now() > active.expires_at) {
    throw new AppError(401, ErrorCode.OTP_EXPIRED, 'code expired — request a new one')
  }
  if (active.attempts >= OTP_MAX_ATTEMPTS) {
    throw new AppError(401, ErrorCode.OTP_INVALID, 'too many wrong attempts — request a new code')
  }
  if (!verifyOtpHash(input.code, active.code_hash)) {
    await deps.store.recordAttempt(active.id)
    throw new AppError(401, ErrorCode.OTP_INVALID, 'incorrect code')
  }
  await deps.store.consume(active.id)
}
