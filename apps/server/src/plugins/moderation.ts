import fp from 'fastify-plugin'
import type { FastifyPluginAsync } from 'fastify'
import { invalidateBlocklistCache } from '@server/lib/moderation'

declare module 'fastify' {
  interface FastifyInstance {
    /** Bust the blocklist cache — call after adding/removing keywords. */
    invalidateBlocklistCache(): void
  }
}

const moderationPlugin: FastifyPluginAsync = async (fastify) => {
  fastify.decorate('invalidateBlocklistCache', invalidateBlocklistCache)
}

export default fp(moderationPlugin, { name: 'moderation', dependencies: ['db'] })
