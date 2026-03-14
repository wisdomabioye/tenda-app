import { FastifyPluginAsync } from 'fastify'
import { ErrorCode } from '@tenda/shared'
import { buildRefundExpiredInstruction } from '@server/lib/solana'
import { getPlatformConfig } from '@server/lib/platform'
import { ensureGigExists, ensureGigStatus, ensureGigOwnership, checkAndExpireGig } from '@server/lib/gigs'
import { AppError } from '@server/lib/errors'
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
    async (request) => {
      const { gig_id } = request.body

      if (!gig_id) throw new AppError(400, ErrorCode.VALIDATION_ERROR, 'gig_id is required')

      let gig = await ensureGigExists(fastify.db, gig_id)
      ensureGigOwnership(gig, request.user.id, 'poster', 'Only the poster can claim an expired gig refund')

      // Lazily expire the gig if its deadlines have passed — so a poster who
      // hits this endpoint directly (without first opening the gig detail screen)
      // still gets the correct 'expired' status rather than a misleading 400.
      const config = await getPlatformConfig(fastify.db)
      gig = await checkAndExpireGig(gig, fastify.db, config.grace_period_seconds)

      ensureGigStatus(gig, 'expired')

      try {
        return await buildRefundExpiredInstruction(request.user.wallet_address, gig_id)
      } catch {
        throw new AppError(500, ErrorCode.INTERNAL_ERROR, 'Failed to build refund-expired instruction')
      }
    }
  )
}

export default refundExpired
