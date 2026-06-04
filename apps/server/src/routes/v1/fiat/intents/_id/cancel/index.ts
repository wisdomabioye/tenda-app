/**
 * POST /v1/fiat/intents/:id/cancel — user-initiated cancel; only quoted /
 * awaiting_user intents qualify (in-flight provider work can't be
 * unilaterally abandoned).
 */

import type { FastifyPluginAsync } from 'fastify'
import { buildFiatDeps, cancelIntent } from '@server/features/fiat-rails'
import { requireFiatRails } from '@server/lib/fiat-routes'

const route: FastifyPluginAsync = async (fastify) => {
  fastify.post<{ Params: { id: string } }>(
    '/',
    { preHandler: [fastify.authenticate, requireFiatRails] },
    async (request) => {
      const deps = await buildFiatDeps(fastify)
      await cancelIntent(deps, request.user.id, request.params.id)
      return { cancelled: true }
    },
  )
}

export default route
