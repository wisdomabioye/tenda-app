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
 * Delivery is behind `OtpSender`, one per channel (Termii SMS / Resend email,
 * console fallback in dev).
 */

import { isE164, normalizeEmail } from '@tenda/shared'
import type { OtpChannel } from '@tenda/shared/db/schema'
import { auth_otps } from '@tenda/shared/db/schema'

export type { OtpChannel }
import { randomInt, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto'
import { and, eq, gte, isNull, sql } from 'drizzle-orm'
import { ErrorCode } from '@tenda/shared'
import { AppError } from '@server/lib/errors'
import { sendViaResend, type ResendConfig } from '@server/lib/email'
import type { AppDatabase } from '@server/plugins/db'

// ---------- policy constants ------------------------------------------------

export const OTP_TTL_SECONDS = 10 * 60
export const OTP_MAX_ATTEMPTS = 5
export const OTP_MAX_SENDS_PER_IDENTIFIER_PER_HOUR = 3
export const OTP_MAX_SENDS_PER_USER_PER_DAY = 10
export const OTP_CODE_DIGITS = 6

export { isE164 }

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

// ---------- sender abstraction -----------------------------------------------

export interface OtpSender {
  send(identifier: string, code: string): Promise<void>
}

/** The verification SMS body — single source for every SMS transport. */
export function otpSmsText(code: string): string {
  return `Your Tenda verification code is ${code}. Expires in 10 minutes.`
}

export const TERMII_SMS_URL = 'https://api.ng.termii.com/api/sms/send'

/** Termii SMS — regional (api.ng.termii.com is NG/Africa-only). */
export function termiiSender(args: { api_key: string; sender_id: string }): OtpSender {
  return {
    async send(identifier, code) {
      const res = await fetch(TERMII_SMS_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          api_key: args.api_key,
          to: identifier,
          from: args.sender_id,
          sms: otpSmsText(code),
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

export const TWILIO_API_BASE = 'https://api.twilio.com/2010-04-01'

/**
 * Twilio Programmable SMS (the `/Messages` API) — global delivery. We keep our
 * own code lifecycle (auth_otps store + hash + rate-limit + expiry), so Twilio
 * is a transport here, NOT Twilio Verify (which would own the code and fork our
 * channel-agnostic OTP model). `from` is EITHER an E.164 sender number OR a
 * Messaging Service SID (`MG…`, the recommended production sender) — they go in
 * different request params, so we route by prefix. Auth is HTTP Basic
 * (AccountSid:AuthToken).
 */
export function twilioSmsSender(args: {
  account_sid: string
  auth_token: string
  from: string
}): OtpSender {
  // A Messaging Service SID must be sent as `MessagingServiceSid`; an E.164
  // number as `From`. Twilio rejects an `MG…` SID passed as `From` (err 21212).
  const senderParam = args.from.startsWith('MG') ? 'MessagingServiceSid' : 'From'
  return {
    async send(identifier, code) {
      const url = `${TWILIO_API_BASE}/Accounts/${args.account_sid}/Messages.json`
      const credentials = Buffer.from(`${args.account_sid}:${args.auth_token}`).toString('base64')
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Basic ${credentials}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({ To: identifier, [senderParam]: args.from, Body: otpSmsText(code) }).toString(),
      })
      if (!res.ok) {
        throw new AppError(
          502,
          ErrorCode.INTERNAL_ERROR,
          `Twilio send failed with status ${res.status}`,
        )
      }
    },
  }
}

/** One routing rule: a number whose E.164 starts with any of `prefixes` → `sender`. */
export interface SmsRoute {
  prefixes: string[]
  sender: OtpSender
}

/**
 * Compose SMS transports by destination prefix: a number matching a rule's
 * prefix goes to that sender, everything else to `fallback`. Lets a regional
 * provider (Termii for +234) coexist with a global one (Twilio) behind the
 * single per-channel sender the OTP store expects — routing happens per number
 * at send-time, so the rule set stays config-driven (no hardcoded geography).
 */
export function routedSmsSender(routes: SmsRoute[], fallback: OtpSender): OtpSender {
  return {
    async send(identifier, code) {
      const route = routes.find((r) => r.prefixes.some((p) => identifier.startsWith(p)))
      await (route?.sender ?? fallback).send(identifier, code)
    },
  }
}

/**
 * Pick the phone SMS transport from the configured providers (pure — the
 * candidates are pre-built so this stays unit-testable, decoupled from config):
 *   • both → route `prefixes` to Termii (cheaper locally), rest to Twilio.
 *   • one  → that provider for all numbers.
 *   • none → the dev `fallback` (console).
 */
export function composePhoneSender(opts: {
  termii: OtpSender | null
  twilio: OtpSender | null
  prefixes: string[]
  fallback: OtpSender
}): OtpSender {
  if (opts.termii !== null && opts.twilio !== null) {
    return routedSmsSender([{ prefixes: opts.prefixes, sender: opts.termii }], opts.twilio)
  }
  return opts.twilio ?? opts.termii ?? opts.fallback
}

/** Email OTP delivery via the shared Resend transport (consumer copy). */
export function emailOtpSender(cfg: ResendConfig): OtpSender {
  return {
    async send(identifier, code) {
      await sendViaResend(cfg, {
        to: identifier,
        subject: 'Your Tenda verification code',
        text: `Your Tenda verification code is ${code}. It expires in 10 minutes.\n\nIf you did not request this, ignore this email.`,
      })
    },
  }
}

/** Development interim (provider key unset): code lands in the server log. */
export function consoleSender(
  log: { warn(obj: object, msg: string): void },
  channel: OtpChannel = 'phone',
): OtpSender {
  return {
    async send(identifier, code) {
      log.warn(
        { channel, identifier, code },
        `${channel} OTP provider unset — code logged, not sent`,
      )
    },
  }
}

// ---------- store abstraction --------------------------------------------------

export interface OtpStore {
  countRecentByIdentifier(channel: OtpChannel, identifier: string, since: Date): Promise<number>
  countRecentByUser(user_id: string, since: Date): Promise<number>
  insert(row: {
    channel: OtpChannel
    identifier: string
    user_id: string | null
    code_hash: string
    expires_at: Date
  }): Promise<void>
  /**
   * Latest unconsumed OTP for (channel, identifier, user binding). A null
   * user_id matches pre-account rows (passwordless first sign-in); a set
   * user_id binds to that user (stops a second authenticated session from
   * consuming a code issued in someone else's — shared-device edge).
   */
  findActive(
    channel: OtpChannel,
    identifier: string,
    user_id: string | null,
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
    async countRecentByIdentifier(channel, identifier, since) {
      const rows = await db
        .select({ n: sql<number>`count(*)::int` })
        .from(auth_otps)
        .where(
          and(
            eq(auth_otps.channel, channel),
            eq(auth_otps.identifier, identifier),
            gte(auth_otps.created_at, since),
          ),
        )
      return rows[0]?.n ?? 0
    },
    async countRecentByUser(user_id, since) {
      const rows = await db
        .select({ n: sql<number>`count(*)::int` })
        .from(auth_otps)
        .where(and(eq(auth_otps.user_id, user_id), gte(auth_otps.created_at, since)))
      return rows[0]?.n ?? 0
    },
    async insert(row) {
      await db.insert(auth_otps).values(row)
    },
    async findActive(channel, identifier, user_id) {
      const rows = await db
        .select({
          id: auth_otps.id,
          code_hash: auth_otps.code_hash,
          expires_at: auth_otps.expires_at,
          attempts: auth_otps.attempts,
        })
        .from(auth_otps)
        .where(
          and(
            eq(auth_otps.channel, channel),
            eq(auth_otps.identifier, identifier),
            user_id === null ? isNull(auth_otps.user_id) : eq(auth_otps.user_id, user_id),
            isNull(auth_otps.consumed_at),
          ),
        )
        .orderBy(sql`${auth_otps.created_at} DESC`)
        .limit(1)
      return rows[0] ?? null
    },
    async recordAttempt(id) {
      await db
        .update(auth_otps)
        .set({ attempts: sql`${auth_otps.attempts} + 1` })
        .where(eq(auth_otps.id, id))
    },
    async consume(id) {
      await db.update(auth_otps).set({ consumed_at: new Date() }).where(eq(auth_otps.id, id))
    },
  }
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
