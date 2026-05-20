/**
 * GET /v1/escrows/:id — return the escrow row + appropriate details satellite.
 *
 * Authorization: any party with a role on the escrow (creator, counterparty,
 * assigned, or dispute_admin) may read. Stage 0 returns just the base row;
 * satellite-table merging (gig_details / exchange_details) lands in a
 * follow-up pass when those routes consolidate (#37).
 */

import type { FastifyPluginAsync } from 'fastify'
import { loadEscrowOr404, deriveCaller } from '@server/lib/escrow-routes'
import { AppError } from '@server/lib/errors'
import { ErrorCode } from '@tenda/shared'

const route: FastifyPluginAsync = async (fastify) => {
  fastify.get<{ Params: { id: string } }>(
    '/',
    { preHandler: [fastify.authenticate] },
    async (request) => {
      const escrow = await loadEscrowOr404(fastify.db, request.params.id)
      const caller = deriveCaller({
        user_id: request.user.id,
        role: request.user.role,
        escrow,
      })
      if (caller === null) {
        throw new AppError(
          403,
          ErrorCode.FORBIDDEN,
          `user has no role on escrow ${escrow.id}`,
        )
      }
      return { escrow }
    },
  )
}

export default route
