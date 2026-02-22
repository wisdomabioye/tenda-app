import { FastifyPluginAsync } from 'fastify'
import { getPlatformConfig } from '../../../lib/platform'
import type { PlatformContract } from '@tenda/shared'

type ConfigRoute = PlatformContract['config']

const platformRoutes: FastifyPluginAsync = async (fastify) => {
  // GET /v1/platform/config — public endpoint returning current platform fee
  fastify.get<{
    Reply: ConfigRoute['response']
  }>('/config', { config: { rateLimit: { max: 30, timeWindow: '1 minute' } } }, async (_request, _reply) => {
    const { fee_bps } = await getPlatformConfig(fastify.db)
    return { fee_bps }
  })
}

export default platformRoutes
