/**
 * Chain adapter registry plugin. Builds the registry once at boot and
 * decorates `fastify.chains` so routes can resolve adapters by `chain_id`
 * without re-running the factory per request.
 *
 * This plugin owns the adapter's DB-backed resolvers. INTERIM (pre-cutover)
 * implementations:
 *   - wallet: legacy `users.wallet_address` (single-wallet) — flips to
 *     `user_wallets` (schema-v2) at the Stage-0 cutover (#34).
 *   - asset:  config-driven map ('SOL' native, 'USDC_SOL' via
 *     SOLANA_USDC_MINT) — flips to the seeded `assets` table at cutover.
 */

import fp from 'fastify-plugin'
import type { FastifyPluginAsync } from 'fastify'
import { and, eq } from 'drizzle-orm'
import { users } from '@tenda/shared/db/schema'
import { user_wallets } from '@tenda/shared/db/schema-v2/identity'
import { ErrorCode } from '@tenda/shared'
import { buildChainRegistry } from '@server/chains'
import { fetchPaymasterHttp } from '@server/chains/evm/paymaster'
import { getConfig } from '@server/config'
import { AppError } from '@server/lib/errors'
import { drizzleSponsorStore, reserveSponsoredTx } from '@server/lib/sponsor'
import { CELO_CUSD_ADDR, CELO_USDC_ADDR } from '@server/chains/celo/config'

const chainsPlugin: FastifyPluginAsync = async (fastify) => {
  const config = getConfig()

  // Shared across BASE + CELO: one linked EVM wallet per user (eip155
  // rows in user_wallets serve every EVM chain).
  async function resolveEvmWallet(user_id: string): Promise<string> {
    const rows = await fastify.db
      .select({ address: user_wallets.address })
      .from(user_wallets)
      .where(and(eq(user_wallets.user_id, user_id), eq(user_wallets.chain_ns, 'eip155')))
      .limit(1)
    const wallet = rows[0]?.address
    if (wallet === undefined) {
      throw new AppError(404, ErrorCode.USER_NOT_FOUND, `no EVM wallet linked for user ${user_id}`)
    }
    return wallet
  }

  const registry = buildChainRegistry(config, {
    solana: {
      async resolveWalletAddress(user_id) {
        const rows = await fastify.db
          .select({ wallet_address: users.wallet_address })
          .from(users)
          .where(eq(users.id, user_id))
          .limit(1)
        const wallet = rows[0]?.wallet_address
        if (wallet === undefined || wallet === null || wallet === '') {
          throw new AppError(
            404,
            ErrorCode.USER_NOT_FOUND,
            `no wallet address on record for user ${user_id}`,
          )
        }
        return wallet
      },

      async resolveAsset(asset) {
        if (asset === 'SOL') return { token_address: null }
        if (asset === 'USDC_SOL') {
          if (config.SOLANA_USDC_MINT === null) {
            throw new AppError(
              500,
              ErrorCode.INTERNAL_ERROR,
              'USDC_SOL requested but SOLANA_USDC_MINT is not configured',
            )
          }
          return { token_address: config.SOLANA_USDC_MINT }
        }
        throw new AppError(
          422,
          ErrorCode.ESCROW_INVALID_ASSET,
          `unknown Solana asset '${asset}' (interim resolver supports SOL, USDC_SOL)`,
        )
      },
    },

    // Stage 3 (BASE). EVM wallets live in user_wallets (chain_ns='eip155')
    // from day one — there is no legacy single-wallet column to flip from.
    base: {
      resolveWalletAddress: resolveEvmWallet,

      async resolveAsset(asset) {
        if (asset === 'ETH_BASE') return { token_address: null }
        if (asset === 'USDC_BASE') {
          if (config.BASE_USDC_ADDR === null) {
            throw new AppError(
              500,
              ErrorCode.INTERNAL_ERROR,
              'USDC_BASE requested but BASE_USDC_ADDR is not configured',
            )
          }
          return { token_address: config.BASE_USDC_ADDR }
        }
        throw new AppError(
          422,
          ErrorCode.ESCROW_INVALID_ASSET,
          `unknown BASE asset '${asset}' (supports USDC_BASE, ETH_BASE)`,
        )
      },

      // Reserve-at-build (stage-3 § Paymaster): a successful probe IS the
      // atomic quota decrement; the reconciliation cron repairs drift when
      // a sponsored build never lands on-chain.
      async shouldSponsor(user_id) {
        const result = await reserveSponsoredTx(drizzleSponsorStore(fastify.db), {
          user_id,
          chain_id: 'eip155:8453',
        })
        return result.sponsored
      },

      ...(config.COINBASE_PAYMASTER_URL !== null
        ? { paymaster: fetchPaymasterHttp(config.COINBASE_PAYMASTER_URL) }
        : {}),
    },

    // Stage 4 (CELO): same wallet resolver, CELO asset map, NO paymaster
    // and NO sponsorship probe — gas rides feeCurrency=cUSD on every tx.
    celo: {
      resolveWalletAddress: resolveEvmWallet,

      async resolveAsset(asset) {
        if (asset === 'CELO') return { token_address: null }
        if (asset === 'cUSD') return { token_address: CELO_CUSD_ADDR }
        if (asset === 'USDC_CELO') return { token_address: CELO_USDC_ADDR }
        throw new AppError(
          422,
          ErrorCode.ESCROW_INVALID_ASSET,
          `unknown CELO asset '${asset}' (supports cUSD, USDC_CELO, CELO)`,
        )
      },
    },
  })

  fastify.decorate('chains', registry)
}

export default fp(chainsPlugin, { name: 'chains', dependencies: ['db'] })
