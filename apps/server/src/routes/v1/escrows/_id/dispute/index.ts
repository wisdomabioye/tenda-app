/**
 * POST /v1/escrows/:id/dispute — either party raises a dispute.
 *
 * Body: { bond_raw } — dispute bond paid by the raiser; refunded on win,
 * forfeited on loss. Amount validated against platform_config at the
 * contract layer; server passes through.
 *
 * State machine: accepted | submitted → disputed.
 */

import type { FastifyPluginAsync } from 'fastify'
import { AppError } from '@server/lib/errors'
import { ErrorCode } from '@tenda/shared'
import { getPlatformConfig } from '@server/lib/platform'
import { guardTransition } from '@server/lib/escrow-routes'

interface Body { bond_raw: string }

const route: FastifyPluginAsync = async (fastify) => {
  fastify.post<{ Params: { id: string }; Body: Body }>(
    '/',
    { preHandler: [fastify.authenticate] },
    async (request) => {
      const { bond_raw } = request.body
      if (typeof bond_raw !== 'string' || !/^[0-9]+$/.test(bond_raw)) {
        throw new AppError(
          400,
          ErrorCode.VALIDATION_ERROR,
          'bond_raw required (numeric string)',
        )
      }
      const cfg = await getPlatformConfig(fastify.db)
      const { escrow } = await guardTransition({
        db: fastify.db,
        escrow_id: request.params.id,
        user_id: request.user.id,
        role: request.user.role,
        now: new Date(),
        grace_period_seconds: cfg.grace_period_seconds,
        transition: 'dispute',
      })
      const adapter = fastify.chains.get(escrow.chain_id)
      const unsigned = await adapter.buildTx({
        action: 'disputeEscrow',
        user_id: request.user.id,
        payload: { escrow_id: escrow.id, bond_raw },
      })
      return { unsigned }
    },
  )
}

export default route
