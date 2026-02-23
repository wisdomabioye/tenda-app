import { FastifyPluginAsync } from 'fastify'
import { eq } from 'drizzle-orm'
import { gigs } from '@tenda/shared/db/schema'
import { ErrorCode } from '@tenda/shared'
import { buildDisputeGigInstruction } from '../../../lib/solana'
import type { BlockchainContract, ApiError } from '@tenda/shared'

type DisputeGigRoute = BlockchainContract['disputeGig']

const disputeGig: FastifyPluginAsync = async (fastify) => {
  // POST /v1/blockchain/dispute-gig
  // Builds an unsigned dispute_gig Anchor instruction for the initiator (poster or worker) to sign.
  // After signing on-chain, caller calls POST /v1/gigs/:id/dispute with the signature and reason.
  fastify.post<{
    Body:  DisputeGigRoute['body']
    Reply: DisputeGigRoute['response'] | ApiError
  }>(
    '/dispute-gig',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const { gig_id, reason } = request.body

      if (!gig_id || !reason) {
        return reply.code(400).send({
          statusCode: 400,
          error: 'Bad Request',
          message: 'gig_id and reason are required',
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

      if (gig.status !== 'submitted' && gig.status !== 'accepted') {
        return reply.code(400).send({
          statusCode: 400,
          error: 'Bad Request',
          message: 'Can only dispute gigs that are accepted or submitted',
          code: ErrorCode.GIG_WRONG_STATUS,
        })
      }

      const userId = request.user.id
      if (gig.poster_id !== userId && gig.worker_id !== userId) {
        return reply.code(403).send({
          statusCode: 403,
          error: 'Forbidden',
          message: 'Only the poster or worker can dispute this gig',
          code: ErrorCode.FORBIDDEN,
        })
      }

      try {
        return await buildDisputeGigInstruction(request.user.wallet_address, gig_id, reason)
      } catch {
        return reply.code(500).send({
          statusCode: 500,
          error: 'Internal Server Error',
          message: 'Failed to build dispute-gig instruction',
          code: ErrorCode.INTERNAL_ERROR,
        })
      }
    }
  )
}

export default disputeGig
