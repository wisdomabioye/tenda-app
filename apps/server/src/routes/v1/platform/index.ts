import { FastifyPluginAsync } from 'fastify'
import { asc, eq } from 'drizzle-orm'
import { chains, assets } from '@tenda/shared/db/schema'
import { getPlatformConfig } from '@server/lib/platform'
import { getExchangeRates } from '@server/lib/exchange-rates'
import {
  chainById,
  chainPublicFacts,
  exchangeAssetsByChain,
  findChain,
  gigAssetByChain,
  type AssetRole,
  type ChainRegistryEntry,
  type PlatformContract,
} from '@tenda/shared'

/** EIP-2612 capability comes from the manifest (config), not the DB row. */
function supportsPermit(chain_id: string, asset_id: string): boolean {
  const asset = findChain(chain_id)?.assets.find((a) => a.id === asset_id)
  return asset?.permit !== undefined
}

/**
 * What an asset may be used for on this chain, read from the SAME functions
 * the escrow validators refuse with — not from the manifest's `roles` array.
 *
 * The distinction is the point. `gigAssetByChain` returns ONE asset per chain
 * (the first carrying the gig role); a manifest that ever listed two would make
 * the second a role this endpoint advertises and `assertGigAsset` rejects. By
 * asking the enforcer instead, the published answer is by construction the one
 * a caller will get, so this cannot promise what the 422 takes away.
 */
function rolesOf(chain_id: string, asset_id: string): AssetRole[] {
  return [
    ...(gigAssetByChain(chain_id) === asset_id ? (['gig'] as const) : []),
    ...(exchangeAssetsByChain(chain_id).includes(asset_id) ? (['exchange'] as const) : []),
  ]
}

type ConfigRoute        = PlatformContract['config']
type ExchangeRatesRoute = PlatformContract['exchangeRates']
type ChainsRoute        = PlatformContract['chains']

const platformRoutes: FastifyPluginAsync = async (fastify) => {
  // GET /v1/platform/config, public endpoint returning current platform fee
  fastify.get<{
    Reply: ConfigRoute['response']
  }>('/config', { config: { rateLimit: { max: 30, timeWindow: '1 minute' } } }, async () => {
    const { fee_bps, seeker_fee_bps, grace_period_seconds } = await getPlatformConfig(fastify.db)
    return { fee_bps, seeker_fee_bps, grace_period_seconds }
  })

  // GET /v1/platform/exchange-rates, public endpoint proxying CoinGecko (5-min server cache)
  // Centralises rate fetching so devices share one quota instead of each calling CoinGecko directly.
  fastify.get<{
    Reply: ExchangeRatesRoute['response']
  }>('/exchange-rates', { config: { rateLimit: { max: 60, timeWindow: '1 minute' } } }, async () => {
    return getExchangeRates()
  })

  // GET /v1/platform/chains, enabled chains + their enabled assets (CO5
  // chain/asset picker source). Public.
  //
  // The escrow address comes from the ADAPTER REGISTRY, not from
  // `chains.escrow_program`.
  // Mobile signs its own transactions, so this response is the only way it
  // learns which contract to call — and the DB column is written solely by
  // `db:seed`, while env is re-read every boot. That gap let the column drift
  // two contract generations behind on both EVM testnets with nothing failing
  // server-side (2026-07-27). Serving the value the server itself uses removes
  // the class of bug; `assertChainRegistryInSync` keeps the stored copy honest.
  //
  // A chain enabled in the DB but with no adapter is therefore omitted rather
  // than advertised: the server cannot build or verify a transaction on it, so
  // offering it to a client is offering a dead end.
  fastify.get<{
    Reply: ChainsRoute['response']
  }>('/chains', { config: { rateLimit: { max: 30, timeWindow: '1 minute' } } }, async () => {
    const [chainRows, assetRows] = await Promise.all([
      fastify.db
        .select({
          id: chains.id,
          namespace: chains.namespace,
          display_name: chains.display_name,
        })
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
          token_address: assets.token_address,
        })
        .from(assets)
        .where(eq(assets.is_enabled, true))
        .orderBy(asc(assets.id)),
    ])

    const data: ChainRegistryEntry[] = chainRows.flatMap((c) => {
      if (!fastify.chains.has(c.id)) return []
      const adapter = fastify.chains.get(c.id)
      // The public facts of the chain come from the manifest, through the ONE
      // shared mapping (#137); the one fact about THIS deployment — whether it
      // holds a relayer — comes from the adapter, the same object
      // `relayDraftFunding` refuses on when it is absent (#132). Read from the
      // same place so this cannot advertise a relay the 503 takes away.
      return [
        {
          ...c,
          // Total by construction: every adapter is built from a manifest entry.
          network_kind: chainById(c.id).kind,
          escrow_address: adapter.escrowAddress,
          relayed_funding_available: adapter.relay !== undefined,
          ...chainPublicFacts(c.id),
          assets: assetRows
            .filter((a) => a.chain_id === c.id)
            .map(({ chain_id: _chain_id, ...asset }) => ({
              ...asset,
              supports_permit: supportsPermit(c.id, asset.id),
              roles: rolesOf(c.id, asset.id),
            })),
        },
      ]
    })
    return { data }
  })
}

export default platformRoutes
