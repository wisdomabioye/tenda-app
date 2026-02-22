import { FastifyPluginAsync } from 'fastify'
import { eq } from 'drizzle-orm'
import { gigs } from '@tenda/shared/db/schema'
import { ErrorCode } from '@tenda/shared'
import { buildSubmitProofInstruction } from '../../../lib/solana'
import type { BlockchainContract, ApiError } from '@tenda/shared'

type SubmitProofRoute = BlockchainContract['submitProof']

const submitProof: FastifyPluginAsync = async (fastify) => {
  // POST /v1/blockchain/submit-proof
  // Builds an unsigned submit_proof Anchor instruction for the worker to sign.
  // Caller must be the assigned worker and the gig must be in 'accepted' status.
  // After signing on-chain, caller calls POST /v1/gigs/:id/submit with the signature + proofs.
  fastify.post<{
    Body: SubmitProofRoute['body']
    Reply: SubmitProofRoute['response'] | ApiError
  }>(
    '/submit-proof',
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

      if (gig.worker_id !== request.user.id) {
        return reply.code(403).send({
          statusCode: 403,
          error: 'Forbidden',
          message: 'Only the assigned worker can submit proof',
          code: ErrorCode.FORBIDDEN,
        })
      }

      if (gig.status !== 'accepted') {
        return reply.code(400).send({
          statusCode: 400,
          error: 'Bad Request',
          message: 'Gig must be in accepted status to submit proof',
          code: ErrorCode.GIG_WRONG_STATUS,
        })
      }

      try {
        const result = await buildSubmitProofInstruction(request.user.wallet_address, gig_id)
        return result
      } catch {
        return reply.code(500).send({
          statusCode: 500,
          error: 'Internal Server Error',
          message: 'Failed to build submit-proof instruction',
          code: ErrorCode.INTERNAL_ERROR,
        })
      }
    }
  )
}

export default submitProof
