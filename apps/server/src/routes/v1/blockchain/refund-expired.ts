import { FastifyPluginAsync } from 'fastify'
import { eq } from 'drizzle-orm'
import { gigs } from '@tenda/shared/db/schema'
import { ErrorCode } from '@tenda/shared'
import { buildRefundExpiredInstruction } from '../../../lib/solana'
import { getPlatformConfig } from '../../../lib/platform'
import { checkAndExpireGig } from '../../../lib/gigs'
import type { BlockchainContract, ApiError } from '@tenda/shared'

type RefundExpiredRoute = BlockchainContract['refundExpired']

const refundExpired: FastifyPluginAsync = async (fastify) => {
  // POST /v1/blockchain/refund-expired
  // Builds an unsigned refund_expired Anchor instruction.
  // Caller must be the poster and the gig must be in 'expired' status.
  // The poster pays the tx fee and receives the escrow refund on-chain.
  // After signing on-chain, the frontend can call GET /v1/gigs/:id to confirm the updated status.
  fastify.post<{
    Body: RefundExpiredRoute['body']
    Reply: RefundExpiredRoute['response'] | ApiError
  }>(
    '/refund-expired',
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

      let [gig] = await fastify.db.select().from(gigs).where(eq(gigs.id, gig_id)).limit(1)

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
          message: 'Only the poster can claim an expired gig refund',
          code: ErrorCode.FORBIDDEN,
        })
      }

      // Lazily expire the gig if its deadlines have passed — so a poster who
      // hits this endpoint directly (without first opening the gig detail screen)
      // still gets the correct 'expired' status rather than a misleading 400.
      const config = await getPlatformConfig(fastify.db)
      gig = await checkAndExpireGig(gig, fastify.db, config.grace_period_seconds)

      if (gig.status !== 'expired') {
        return reply.code(400).send({
          statusCode: 400,
          error: 'Bad Request',
          message: 'Gig must be in expired status to claim a refund',
          code: ErrorCode.GIG_WRONG_STATUS,
        })
      }

      try {
        const result = await buildRefundExpiredInstruction(request.user.wallet_address, gig_id)
        return result
      } catch {
        return reply.code(500).send({
          statusCode: 500,
          error: 'Internal Server Error',
          message: 'Failed to build refund-expired instruction',
          code: ErrorCode.INTERNAL_ERROR,
        })
      }
    }
  )
}

export default refundExpired
