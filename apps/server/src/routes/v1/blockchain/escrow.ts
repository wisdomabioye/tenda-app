import { FastifyPluginAsync } from 'fastify'
import { eq } from 'drizzle-orm'
import { gigs } from '@tenda/shared/db/schema'
import { ErrorCode } from '@tenda/shared'
import { buildCreateGigEscrowInstruction } from '../../../lib/solana'
import type { BlockchainContract, ApiError } from '@tenda/shared'

type EscrowRoute = BlockchainContract['createEscrow']

const escrow: FastifyPluginAsync = async (fastify) => {
  // POST /v1/blockchain/create-escrow
  // Builds an unsigned create_gig_escrow Anchor instruction for the poster to sign.
  // Caller must be the poster and the gig must be in 'draft' status.
  // After signing on-chain, caller calls POST /v1/gigs/:id/publish with the signature.
  fastify.post<{
    Body: EscrowRoute['body']
    Reply: EscrowRoute['response'] | ApiError
  }>(
    '/create-escrow',
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
          message: 'Only the poster can publish this gig',
          code: ErrorCode.FORBIDDEN,
        })
      }

      if (gig.status !== 'draft') {
        return reply.code(400).send({
          statusCode: 400,
          error: 'Bad Request',
          message: 'Only draft gigs can be published on-chain',
          code: ErrorCode.GIG_WRONG_STATUS,
        })
      }

      try {
        const acceptDeadline = gig.accept_deadline ? new Date(gig.accept_deadline) : null
        const result = await buildCreateGigEscrowInstruction(
          request.user.wallet_address,
          gig_id,
          Number(gig.payment_lamports),
          gig.completion_duration_seconds,
          acceptDeadline,
        )
        return result
      } catch (error) {
        console.log('error', error)
        return reply.code(500).send({
          statusCode: 500,
          error: 'Internal Server Error',
          message: 'Failed to build create-escrow instruction',
          code: ErrorCode.INTERNAL_ERROR,
        })
      }
    }
  )
}

export default escrow
