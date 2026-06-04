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
import { eq } from 'drizzle-orm'
import { users } from '@tenda/shared/db/schema'
import { ErrorCode } from '@tenda/shared'
import { buildChainRegistry } from '@server/chains'
import { getConfig } from '@server/config'
import { AppError } from '@server/lib/errors'

const chainsPlugin: FastifyPluginAsync = async (fastify) => {
  const config = getConfig()

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
  })

  fastify.decorate('chains', registry)
}

export default fp(chainsPlugin, { name: 'chains', dependencies: ['db'] })
