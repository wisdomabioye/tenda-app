/**
 * Chain adapter registry plugin. Builds the registry once at boot from
 * `getConfig()` and decorates `fastify.chains` so routes can resolve adapters
 * by `chain_id` without re-running the factory per request.
 */

import fp from 'fastify-plugin'
import type { FastifyPluginAsync } from 'fastify'
import { buildChainRegistry } from '@server/chains'
import { getConfig } from '@server/config'

const chainsPlugin: FastifyPluginAsync = async (fastify) => {
  const registry = buildChainRegistry(getConfig())
  fastify.decorate('chains', registry)
}

export default fp(chainsPlugin, { name: 'chains' })
