import { FastifyPluginAsync } from 'fastify'
import { eq } from 'drizzle-orm'
import { gigs, users } from '@tenda/shared/db/schema'
import { ErrorCode } from '@tenda/shared'
import { buildApproveCompletionInstruction } from '../../../lib/solana'
import { getConfig } from '../../../config'
import type { BlockchainContract, ApiError } from '@tenda/shared'

type ApproveEscrowRoute = BlockchainContract['approveEscrow']

const approveEscrow: FastifyPluginAsync = async (fastify) => {
  // POST /v1/blockchain/approve-escrow
  // Builds an unsigned approve_completion Anchor instruction for the poster to sign.
  // Caller must be the poster and the gig must be in 'submitted' status.
  // After signing on-chain, caller calls POST /v1/gigs/:id/approve with the signature.
  fastify.post<{
    Body: ApproveEscrowRoute['body']
    Reply: ApproveEscrowRoute['response'] | ApiError
  }>(
    '/approve-escrow',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const { gig_id } = request.body

      if (!gig_id) {
        return reply.code(400).send({
          statusCode: 400,
          error: 'Bad Request',
          message: 'gig_id is required',
          code: ErrorCode.VALIDATION_ERROR,
        })
      }

      const [gig] = await fastify.db.select().from(gigs).where(eq(gigs.id, gig_id)).limit(1)

      if (!gig) {
        return reply.code(404).send({
          statusCode: 404,
          error: 'Not Found',
          message: 'Gig not found',
          code: ErrorCode.GIG_NOT_FOUND,
        })
      }

      if (gig.poster_id !== request.user.id) {
        return reply.code(403).send({
          statusCode: 403,
          error: 'Forbidden',
          message: 'Only the poster can approve this gig',
          code: ErrorCode.FORBIDDEN,
        })
      }

      if (gig.status !== 'submitted') {
        return reply.code(400).send({
          statusCode: 400,
          error: 'Bad Request',
          message: 'Gig must be in submitted status to approve',
          code: ErrorCode.GIG_WRONG_STATUS,
        })
      }

      if (!gig.worker_id) {
        return reply.code(400).send({
          statusCode: 400,
          error: 'Bad Request',
          message: 'Gig has no assigned worker',
          code: ErrorCode.VALIDATION_ERROR,
        })
      }

      const [worker] = await fastify.db
        .select({ wallet_address: users.wallet_address })
        .from(users)
        .where(eq(users.id, gig.worker_id))
        .limit(1)

      if (!worker) {
        return reply.code(404).send({
          statusCode: 404,
          error: 'Not Found',
          message: 'Worker not found',
          code: ErrorCode.USER_NOT_FOUND,
        })
      }

      try {
        const result = await buildApproveCompletionInstruction(
          request.user.wallet_address,
          worker.wallet_address,
          gig_id,
          getConfig().SOLANA_TREASURY_ADDRESS,
        )
        return result
      } catch {
        return reply.code(500).send({
          statusCode: 500,
          error: 'Internal Server Error',
          message: 'Failed to build approve instruction',
          code: ErrorCode.INTERNAL_ERROR,
        })
      }
    }
  )
}

export default approveEscrow
