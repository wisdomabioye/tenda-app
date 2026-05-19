import fp from 'fastify-plugin'
import type { FastifyPluginAsync } from 'fastify'
import { invalidateBlocklistCache } from '@server/lib/moderation'

// Augmentation lives in `src/types/fastify.d.ts`.

const moderationPlugin: FastifyPluginAsync = async (fastify) => {
  fastify.decorate('invalidateBlocklistCache', invalidateBlocklistCache)
}

export default fp(moderationPlugin, { name: 'moderation', dependencies: ['db'] })
