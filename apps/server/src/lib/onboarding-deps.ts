/**
 * Dependency builders for the Stage-1 onboarding routes. One place wires
 * config → concrete senders so the routes stay declarative and the
 * #32/#40 interims (console OTP, missing seed key) are encoded once.
 */

import type { FastifyInstance } from 'fastify'
import { getConfig } from '@server/config'
import {
  consoleSender,
  drizzleOtpStore,
  termiiSender,
  type OtpDeps,
} from '@server/lib/otp'
import { drizzleGasSeedStore, type GasSeedDeps } from '@server/lib/gas-seed'
import { solanaGasSeedSender } from '@server/chains/solana/gas-seed-sender'

export function buildOtpDeps(fastify: FastifyInstance): OtpDeps {
  const config = getConfig()
  const sender =
    config.TERMII_API_KEY !== null && config.TERMII_SENDER_ID !== null
      ? termiiSender({ api_key: config.TERMII_API_KEY, sender_id: config.TERMII_SENDER_ID })
      : consoleSender(fastify.log)
  return {
    store: drizzleOtpStore(fastify.db),
    sender,
    now: () => new Date(),
  }
}

export function buildGasSeedDeps(fastify: FastifyInstance): GasSeedDeps {
  const config = getConfig()
  return {
    store: drizzleGasSeedStore(fastify.db),
    senders:
      config.SOLANA_GAS_SEED_WALLET_KEY !== null
        ? {
            solana: solanaGasSeedSender({
              rpc_url: config.SOLANA_RPC_URL,
              chain_id: fastify.chains.list()[0]?.chain_id ?? 'solana:devnet',
              secret_key_base58: config.SOLANA_GAS_SEED_WALLET_KEY,
            }),
          }
        : {},
    log: fastify.log,
  }
}
