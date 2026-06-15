/**
 * Chain adapter registry plugin. Builds the registry once at boot and
 * decorates `fastify.chains` so routes can resolve adapters by `chain_id`
 * without re-running the factory per request.
 *
 * Post-cutover (#34) the resolvers are DB-backed:
 *   - wallet: `user_wallets` (multi-wallet, decision #13) — primary wallet
 *     first, falling back to the only linked wallet for the namespace.
 *   - asset:  the seeded `assets` registry table, keyed (id, chain_id).
 */

import fp from 'fastify-plugin'
import type { FastifyPluginAsync } from 'fastify'
import { and, desc, eq } from 'drizzle-orm'
import { assets, user_wallets } from '@tenda/shared/db/schema'
import { ErrorCode, SOLANA_CAIP_BY_NETWORK } from '@tenda/shared'
import { buildChainRegistry } from '@server/chains'
import { fetchPaymasterHttp } from '@server/chains/evm/paymaster'
import { CELO_CHAIN_ID } from '@server/chains/celo/config'
import { getConfig } from '@server/config'
import { AppError } from '@server/lib/errors'
import { drizzleSponsorStore, releaseSponsoredTx, reserveSponsoredTx } from '@server/lib/sponsor'

type ChainNs = 'solana' | 'eip155'

const chainsPlugin: FastifyPluginAsync = async (fastify) => {
  const config = getConfig()

  /**
   * One linked wallet per (user, namespace) serves every chain in that
   * namespace. Primary first so a user with several linked wallets gets
   * deterministic resolution.
   */
  function dbWalletResolver(chain_ns: ChainNs): (user_id: string) => Promise<string> {
    return async (user_id) => {
      const rows = await fastify.db
        .select({ address: user_wallets.address })
        .from(user_wallets)
        .where(and(eq(user_wallets.user_id, user_id), eq(user_wallets.chain_ns, chain_ns)))
        .orderBy(desc(user_wallets.is_primary))
        .limit(1)
      const wallet = rows[0]?.address
      if (wallet === undefined) {
        throw new AppError(
          404,
          ErrorCode.USER_NOT_FOUND,
          `no ${chain_ns} wallet linked for user ${user_id}`,
        )
      }
      return wallet
    }
  }

  /** Assets registry lookup — seeded by db:seed; Stages 3/4 add EVM rows. */
  function dbAssetResolver(chain_id: string): (asset: string) => Promise<{ token_address: string | null }> {
    return async (asset) => {
      const rows = await fastify.db
        .select({ token_address: assets.token_address })
        .from(assets)
        .where(and(eq(assets.id, asset), eq(assets.chain_id, chain_id), eq(assets.is_enabled, true)))
        .limit(1)
      const row = rows[0]
      if (row === undefined) {
        throw new AppError(
          422,
          ErrorCode.ESCROW_INVALID_ASSET,
          `asset '${asset}' is not registered (or disabled) on ${chain_id}`,
        )
      }
      return { token_address: row.token_address }
    }
  }

  const solanaChainId = SOLANA_CAIP_BY_NETWORK[config.SOLANA_NETWORK]
  if (solanaChainId === undefined) {
    throw new Error(`unsupported SOLANA_NETWORK '${config.SOLANA_NETWORK}'`)
  }

  const registry = buildChainRegistry(config, {
    solana: {
      resolveWalletAddress: dbWalletResolver('solana'),
      resolveAsset: dbAssetResolver(solanaChainId),
    },

    // Stage 3 (BASE) + Stage 4 (CELO) share the eip155 wallet rows.
    base: {
      resolveWalletAddress: dbWalletResolver('eip155'),
      resolveAsset: dbAssetResolver('eip155:8453'),

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

      // Symmetric refund for the reserve above: the adapter calls this when a
      // sponsored build fails after the slot was reserved (paymaster outage),
      // so the quota slot isn't leaked.
      async releaseSponsorship(user_id) {
        await releaseSponsoredTx(drizzleSponsorStore(fastify.db), { user_id })
      },

      ...(config.COINBASE_PAYMASTER_URL !== null
        ? { paymaster: fetchPaymasterHttp(config.COINBASE_PAYMASTER_URL) }
        : {}),
    },

    // CELO: NO paymaster and NO sponsorship probe — gas rides
    // feeCurrency=cUSD on every tx.
    celo: {
      resolveWalletAddress: dbWalletResolver('eip155'),
      resolveAsset: dbAssetResolver(CELO_CHAIN_ID),
    },
  })

  fastify.decorate('chains', registry)
}

export default fp(chainsPlugin, { name: 'chains', dependencies: ['db'] })
