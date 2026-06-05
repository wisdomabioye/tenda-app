import { FastifyPluginAsync } from 'fastify'
import { asc, eq } from 'drizzle-orm'
import { chains, assets } from '@tenda/shared/db/schema'
import { getPlatformConfig } from '@server/lib/platform'
import { getExchangeRates } from '@server/lib/exchange-rates'
import type { ChainRegistryEntry, PlatformContract } from '@tenda/shared'

type ConfigRoute        = PlatformContract['config']
type ExchangeRatesRoute = PlatformContract['exchangeRates']
type ChainsRoute        = PlatformContract['chains']

const platformRoutes: FastifyPluginAsync = async (fastify) => {
  // GET /v1/platform/config — public endpoint returning current platform fee
  fastify.get<{
    Reply: ConfigRoute['response']
  }>('/config', { config: { rateLimit: { max: 30, timeWindow: '1 minute' } } }, async () => {
    const { fee_bps, seeker_fee_bps, grace_period_seconds } = await getPlatformConfig(fastify.db)
    return { fee_bps, seeker_fee_bps, grace_period_seconds }
  })

  // GET /v1/platform/exchange-rates — public endpoint proxying CoinGecko (5-min server cache)
  // Centralises rate fetching so devices share one quota instead of each calling CoinGecko directly.
  fastify.get<{
    Reply: ExchangeRatesRoute['response']
  }>('/exchange-rates', { config: { rateLimit: { max: 60, timeWindow: '1 minute' } } }, async () => {
    return getExchangeRates()
  })

  // GET /v1/platform/chains — enabled chains + their enabled assets (CO5
  // chain/asset picker source). Public; the seed owns the data.
  fastify.get<{
    Reply: ChainsRoute['response']
  }>('/chains', { config: { rateLimit: { max: 30, timeWindow: '1 minute' } } }, async () => {
    const [chainRows, assetRows] = await Promise.all([
      fastify.db
        .select({ id: chains.id, namespace: chains.namespace, display_name: chains.display_name })
        .from(chains)
        .where(eq(chains.is_enabled, true))
        .orderBy(asc(chains.id)),
      fastify.db
        .select({
          id: assets.id,
          chain_id: assets.chain_id,
          symbol: assets.symbol,
          decimals: assets.decimals,
          is_stable: assets.is_stable,
        })
        .from(assets)
        .where(eq(assets.is_enabled, true))
        .orderBy(asc(assets.id)),
    ])

    const data: ChainRegistryEntry[] = chainRows.map((c) => ({
      ...c,
      assets: assetRows
        .filter((a) => a.chain_id === c.id)
        .map(({ chain_id: _chain_id, ...asset }) => asset),
    }))
    return { data }
  })
}

export default platformRoutes
