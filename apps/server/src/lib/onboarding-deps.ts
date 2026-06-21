/**
 * Dependency builders for the Stage-1 onboarding routes. One place wires
 * config → concrete senders so the routes stay declarative and the
 * #32/#40 interims (console OTP, missing seed key) are encoded once.
 */

import type { FastifyInstance } from 'fastify'
import { getConfig } from '@server/config'
import {
  composePhoneSender,
  consoleSender,
  drizzleOtpStore,
  emailOtpSender,
  termiiSender,
  twilioSmsSender,
  type OtpDeps,
  type OtpSender,
} from '@server/lib/otp'
import { dispatchGasSeeds, drizzleGasSeedStore, type GasSeedDeps } from '@server/lib/gas-seed'
import { solanaGasSeedSender } from '@server/chains/solana/gas-seed-sender'
import { solanaSecret } from '@server/chains/secrets'

/**
 * Pick the phone SMS transport: prefer cost-optimal routing (Termii for its
 * configured prefixes, Twilio for the global rest) when BOTH are set; else
 * whichever single provider is configured; else the dev console fallback.
 */
function buildPhoneSender(fastify: FastifyInstance): OtpSender {
  const config = getConfig()
  const termii =
    config.TERMII_API_KEY !== null && config.TERMII_SENDER_ID !== null
      ? termiiSender({ api_key: config.TERMII_API_KEY, sender_id: config.TERMII_SENDER_ID })
      : null
  const twilio =
    config.TWILIO_ACCOUNT_SID !== null &&
    config.TWILIO_AUTH_TOKEN !== null &&
    config.TWILIO_SMS_FROM !== null
      ? twilioSmsSender({
          account_sid: config.TWILIO_ACCOUNT_SID,
          auth_token: config.TWILIO_AUTH_TOKEN,
          from: config.TWILIO_SMS_FROM,
        })
      : null

  return composePhoneSender({
    termii,
    twilio,
    prefixes: config.TERMII_COUNTRY_PREFIXES,
    fallback: consoleSender(fastify.log, 'phone'),
  })
}

export function buildOtpDeps(fastify: FastifyInstance): OtpDeps {
  const config = getConfig()
  const email: OtpSender =
    config.RESEND_API_KEY !== null && config.EMAIL_FROM !== null
      ? emailOtpSender({ api_key: config.RESEND_API_KEY, from: config.EMAIL_FROM })
      : consoleSender(fastify.log, 'email')
  return {
    store: drizzleOtpStore(fastify.db),
    senders: { phone: buildPhoneSender(fastify), email },
    now: () => new Date(),
  }
}

/**
 * Fire-and-forget retroactive gas seed for a user whose phone-verify or
 * wallet-link may have just made them eligible. Verification must not block on
 * an RPC transfer, so failures are logged, not surfaced. `dispatchGasSeeds` is
 * idempotent (gas_grants PK) and a cheap no-op when the user has no wallet on a
 * seedable chain, so over-firing (e.g. on a phone login) is safe. ONE place so
 * every trigger (legacy phone shim, link-wallet, unified /auth/verify) stays in
 * lockstep.
 */
export function fireRetroactiveGasSeed(fastify: FastifyInstance, userId: string): void {
  void dispatchGasSeeds(buildGasSeedDeps(fastify), userId).catch((err) =>
    fastify.log.warn({ err, user_id: userId }, 'retroactive gas seed failed'),
  )
}

export function buildGasSeedDeps(fastify: FastifyInstance): GasSeedDeps {
  // Seed only when the active Solana chain supplies a gas-seed key; the chain
  // id and RPC come from that same secret (no hardcoded fallback).
  const solana = solanaSecret()
  return {
    store: drizzleGasSeedStore(fastify.db),
    senders:
      solana?.gasSeedKey !== undefined
        ? {
            solana: solanaGasSeedSender({
              rpc_url: solana.rpcUrl,
              chain_id: solana.chainId,
              secret_key_base58: solana.gasSeedKey,
            }),
          }
        : {},
    log: fastify.log,
  }
}
