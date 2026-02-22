import { FastifyPluginAsync } from 'fastify'
import { eq } from 'drizzle-orm'
import { gigs } from '@tenda/shared/db/schema'
import { ErrorCode } from '@tenda/shared'
import { buildCancelGigInstruction } from '../../../lib/solana'
import type { BlockchainContract, ApiError } from '@tenda/shared'

type CancelEscrowRoute = BlockchainContract['cancelEscrow']

const cancelEscrow: FastifyPluginAsync = async (fastify) => {
  // POST /v1/blockchain/cancel-escrow
  // Builds an unsigned cancel_gig Anchor instruction for the poster to sign.
  // Caller must be the poster and the gig must be in 'open' status (escrow funded).
  // After signing on-chain, caller calls DELETE /v1/gigs/:id with the signature.
  fastify.post<{
    Body: CancelEscrowRoute['body']
    Reply: CancelEscrowRoute['response'] | ApiError
  }>(
    '/cancel-escrow',
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
          message: 'Only the poster can cancel this gig',
          code: ErrorCode.FORBIDDEN,
        })
      }

      if (gig.status !== 'open') {
        return reply.code(400).send({
          statusCode: 400,
          error: 'Bad Request',
          message: 'Only open gigs can be cancelled on-chain',
          code: ErrorCode.GIG_WRONG_STATUS,
        })
      }

      try {
        const result = await buildCancelGigInstruction(request.user.wallet_address, gig_id)
        return result
      } catch {
        return reply.code(500).send({
          statusCode: 500,
          error: 'Internal Server Error',
          message: 'Failed to build cancel instruction',
          code: ErrorCode.INTERNAL_ERROR,
        })
      }
    }
  )
}

export default cancelEscrow
