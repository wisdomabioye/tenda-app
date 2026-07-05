/**
 * POST /v1/escrows/:id/submit, counterparty submits proof of completion.
 *
 * Body: { proof_hash }, 32-byte hex (EVM) or base58 (Solana) digest of the
 * proof bundle. Server doesn't verify the hash format here; the chain
 * contract validates length.
 *
 * State machine: accepted → submitted, time-gated by
 * completion_deadline + grace.
 */

import type { FastifyPluginAsync } from 'fastify'
import { AppError, requireBody } from '@server/lib/errors'
import { ErrorCode } from '@tenda/shared'
import { getPlatformConfig } from '@server/lib/platform'
import { guardTransition } from '@server/lib/escrow-routes'

interface Body { proof_hash: string }

const route: FastifyPluginAsync = async (fastify) => {
  fastify.post<{ Params: { id: string }; Body: Body }>(
    '/',
    { preHandler: [fastify.authenticate] },
    async (request) => {
      const { proof_hash } = requireBody(request.body)
      if (typeof proof_hash !== 'string' || proof_hash.length === 0) {
        throw new AppError(400, ErrorCode.VALIDATION_ERROR, 'proof_hash required')
      }
      const cfg = await getPlatformConfig(fastify.db)
      const { escrow } = await guardTransition({
        db: fastify.db,
        escrow_id: request.params.id,
        user_id: request.user.id,
        role: request.user.role,
        now: new Date(),
        grace_period_seconds: cfg.grace_period_seconds,
        transition: 'submit',
      })
      const adapter = fastify.chains.get(escrow.chain_id)
      const unsigned = await adapter.buildTx({
        action: 'submitProof',
        user_id: request.user.id,
        payload: { escrow_id: escrow.id, proof_hash },
      })
      return { unsigned }
    },
  )
}

export default route
