import { FastifyPluginAsync } from 'fastify'
import { getPlatformConfig } from '@server/lib/platform'
import { getExchangeRates } from '@server/lib/exchange-rates'
import type { PlatformContract } from '@tenda/shared'

type ConfigRoute        = PlatformContract['config']
type ExchangeRatesRoute = PlatformContract['exchangeRates']

const platformRoutes: FastifyPluginAsync = async (fastify) => {
  // GET /v1/platform/config — public endpoint returning current platform fee
  fastify.get<{
    Reply: ConfigRoute['response']
  }>('/config', { config: { rateLimit: { max: 30, timeWindow: '1 minute' } } }, async () => {
    const { fee_bps, seeker_fee_bps } = await getPlatformConfig(fastify.db)
    return { fee_bps, seeker_fee_bps }
  })

  // GET /v1/platform/exchange-rates — public endpoint proxying CoinGecko (5-min server cache)
  // Centralises rate fetching so devices share one quota instead of each calling CoinGecko directly.
  fastify.get<{
    Reply: ExchangeRatesRoute['response']
  }>('/exchange-rates', { config: { rateLimit: { max: 60, timeWindow: '1 minute' } } }, async () => {
    return getExchangeRates()
  })
}

export default platformRoutes
