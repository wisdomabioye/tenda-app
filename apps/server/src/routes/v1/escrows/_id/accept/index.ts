/**
 * POST /v1/escrows/:id/accept, counterparty (or assigned counterparty)
 * accepts an open escrow.
 *
 * State machine: open → accepted, time-gated by accept_deadline.
 * Builds an `acceptEscrow` tx for the client to sign.
 */

import type { FastifyPluginAsync } from 'fastify'
import { getPlatformConfig } from '@server/lib/platform'
import { requireGoodStanding } from '@server/features/reputation/guards'
import { requireProfileComplete } from '@server/lib/guards'
import { assertCanTransact } from '@server/lib/auth/resolver'
import { guardTransition } from '@server/lib/escrow-routes'

const route: FastifyPluginAsync = async (fastify) => {
  fastify.post<{ Params: { id: string } }>(
    '/',
    { preHandler: [fastify.authenticate, requireProfileComplete, requireGoodStanding('accept')] },
    async (request) => {
      const cfg = await getPlatformConfig(fastify.db)
      const { escrow } = await guardTransition({
        db: fastify.db,
        escrow_id: request.params.id,
        user_id: request.user.id,
        role: request.user.role,
        now: new Date(),
        grace_period_seconds: cfg.grace_period_seconds,
        transition: 'accept',
      })
      const adapter = fastify.chains.get(escrow.chain_id)
      // First-transaction gate: the accepter needs a wallet on this chain + a
      // verified contact before they can enter the escrow.
      await assertCanTransact(fastify.db, request.user.id, adapter.namespace)
      const unsigned = await adapter.buildTx({
        action: 'acceptEscrow',
        user_id: request.user.id,
        payload: { escrow_id: escrow.id },
      })
      return { unsigned }
    },
  )
}

export default route
