/**
 * Consumer auth OTP — channel-agnostic issue/verify over the `auth_otps`
 * table (Stage 9 generalised the former phone-only service to phone + email;
 * one lifecycle so the two channels can't drift). Admin login OTP lives in
 * lib/admin-otp.ts (separate table + anti-enumeration semantics).
 *
 * Rules enforced here (route handlers stay thin):
 *   - send: 3 sends per identifier per hour; 10 per user per day (only when
 *     authenticated — pre-account sign-in has no user, so the per-identifier
 *     cap + the route-level per-IP limit carry it).
 *   - verify: max 5 attempts per OTP, 10-minute expiry, single-use.
 *   - codes are 6-digit, scrypt-hashed (node:crypto — no new dep).
 *
 * Delivery is behind `OtpSender` (./senders); persistence behind `OtpStore`
 * (./store). Barrel keeps the `@server/lib/otp` import surface stable.
 */

import { isE164, normalizeEmail } from '@tenda/shared'
import type { OtpChannel } from '@tenda/shared/db/schema'
import { randomInt, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto'
import { ErrorCode } from '@tenda/shared'
import { AppError } from '@server/lib/errors'
import type { OtpSender } from './senders'
import type { OtpStore } from './store'

export type { OtpChannel }
export { isE164 }
export * from './senders'
export * from './store'

// ---------- policy constants ------------------------------------------------

export const OTP_TTL_SECONDS = 10 * 60
export const OTP_MAX_ATTEMPTS = 5
export const OTP_MAX_SENDS_PER_IDENTIFIER_PER_HOUR = 3
export const OTP_MAX_SENDS_PER_USER_PER_DAY = 10
export const OTP_CODE_DIGITS = 6

/** True when `identifier` is well-formed for the channel (pre-send guard). */
export function isValidOtpIdentifier(channel: OtpChannel, identifier: string): boolean {
  return channel === 'phone' ? isE164(identifier) : normalizeEmail(identifier) !== null
}

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

// ---------- service ------------------------------------------------------------

export interface OtpInput {
  channel: OtpChannel
  identifier: string
  /** null for pre-account passwordless sign-in; the user id for an authenticated link. */
  user_id: string | null
}

export interface OtpDeps {
  store: OtpStore
  /** One sender per channel; the service picks by `input.channel`. */
  senders: Record<OtpChannel, OtpSender>
  now(): Date
}

export async function sendOtp(deps: OtpDeps, input: OtpInput): Promise<{ expires_in: number }> {
  if (!isValidOtpIdentifier(input.channel, input.identifier)) {
    throw new AppError(422, ErrorCode.VALIDATION_ERROR, `invalid ${input.channel} identifier`)
  }
  const now = deps.now()
  const hourAgo = new Date(now.getTime() - 3_600_000)

  const byIdentifier = await deps.store.countRecentByIdentifier(
    input.channel,
    input.identifier,
    hourAgo,
  )
  if (byIdentifier >= OTP_MAX_SENDS_PER_IDENTIFIER_PER_HOUR) {
    throw new AppError(429, ErrorCode.OTP_RATE_LIMITED, 'too many OTP requests — try again later')
  }
  // Per-user cap only applies to authenticated sends (a pre-account send has
  // no user to attribute; the per-identifier + per-IP limits carry that case).
  if (input.user_id !== null) {
    const dayAgo = new Date(now.getTime() - 86_400_000)
    const byUser = await deps.store.countRecentByUser(input.user_id, dayAgo)
    if (byUser >= OTP_MAX_SENDS_PER_USER_PER_DAY) {
      throw new AppError(429, ErrorCode.OTP_RATE_LIMITED, 'too many OTP requests — try again later')
    }
  }

  const code = String(randomInt(0, 10 ** OTP_CODE_DIGITS)).padStart(OTP_CODE_DIGITS, '0')
  await deps.store.insert({
    channel: input.channel,
    identifier: input.identifier,
    user_id: input.user_id,
    code_hash: hashOtpCode(code),
    expires_at: new Date(now.getTime() + OTP_TTL_SECONDS * 1000),
  })
  await deps.senders[input.channel].send(input.identifier, code)
  return { expires_in: OTP_TTL_SECONDS }
}

/**
 * Verify a code. Throws OTP_INVALID / OTP_EXPIRED; consumes the OTP on
 * success. The 6th wrong attempt invalidates the OTP (attempts >= max).
 */
export async function verifyOtp(
  deps: Pick<OtpDeps, 'store' | 'now'>,
  input: OtpInput & { code: string },
): Promise<void> {
  const active = await deps.store.findActive(input.channel, input.identifier, input.user_id)
  if (active === null) {
    throw new AppError(401, ErrorCode.OTP_INVALID, 'no active code for this identifier')
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
