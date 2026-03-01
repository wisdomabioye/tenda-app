import { FastifyPluginAsync } from 'fastify'
import { eq } from 'drizzle-orm'
import { gigs } from '@tenda/shared/db/schema'
import { ErrorCode } from '@tenda/shared'
import { buildAcceptGigInstruction, buildCreateUserAccountInstruction, userAccountExists } from '../../../lib/solana'
import type { BlockchainContract, ApiError } from '@tenda/shared'

type AcceptGigRoute = BlockchainContract['acceptGig']

const acceptGig: FastifyPluginAsync = async (fastify) => {
  // POST /v1/blockchain/accept-gig
  // Builds an unsigned accept_gig Anchor instruction for the worker to sign.
  // Caller must not be the poster and the gig must be in 'open' status.
  // After signing on-chain, caller calls POST /v1/gigs/:id/accept with the signature.
  fastify.post<{
    Body: AcceptGigRoute['body']
    Reply: AcceptGigRoute['response'] | ApiError
  }>(
    '/accept-gig',
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

      if (gig.poster_id === request.user.id) {
        return reply.code(400).send({
          statusCode: 400,
          error: 'Bad Request',
          message: 'Cannot accept your own gig',
          code: ErrorCode.CANNOT_ACCEPT_OWN_GIG,
        })
      }

      if (gig.status !== 'open') {
        return reply.code(400).send({
          statusCode: 400,
          error: 'Bad Request',
          message: 'Gig is not open for acceptance',
          code: ErrorCode.GIG_WRONG_STATUS,
        })
      }

      if (gig.accept_deadline && new Date() > new Date(gig.accept_deadline)) {
        return reply.code(400).send({
          statusCode: 400,
          error: 'Bad Request',
          message: 'Acceptance deadline has passed',
          code: ErrorCode.ACCEPT_DEADLINE_PASSED,
        })
      }

      try {
        const [acceptResult, accountExists] = await Promise.all([
          buildAcceptGigInstruction(request.user.wallet_address, gig_id),
          userAccountExists(request.user.wallet_address),
        ])

        if (accountExists) {
          return acceptResult
        }

        // Worker has no on-chain UserAccount yet — include a setup transaction.
        // Mobile will sign both in one wallet session and broadcast them sequentially.
        const { transaction: setup_transaction } = await buildCreateUserAccountInstruction(
          request.user.wallet_address,
        )
        return { ...acceptResult, setup_transaction }
      } catch {
        return reply.code(500).send({
          statusCode: 500,
          error: 'Internal Server Error',
          message: 'Failed to build accept-gig instruction',
          code: ErrorCode.INTERNAL_ERROR,
        })
      }
    }
  )
}

export default acceptGig
