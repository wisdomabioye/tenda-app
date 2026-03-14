import { FastifyPluginAsync } from 'fastify'
import { gig_transactions } from '@tenda/shared/db/schema'
import { ErrorCode, computePlatformFee } from '@tenda/shared'
import { ensureSignatureVerified } from '@server/lib/solana'
import { getPlatformConfig } from '@server/lib/platform'
import { ensureGigExists, ensureGigStatus, ensureGigOwnership, checkAndExpireGig } from '@server/lib/gigs'
import { handleUniqueConflict } from '@server/lib/db'
import { AppError } from '@server/lib/errors'
import type { GigsContract, ApiError } from '@tenda/shared'

type RefundRoute = GigsContract['refund']

const refundExpired: FastifyPluginAsync = async (fastify) => {
  // POST /v1/gigs/:id/refund — poster records the expired-gig refund transaction in the DB.
  // Caller must first call POST /v1/blockchain/refund-expired to get the unsigned tx,
  // sign + submit to Solana, then call this endpoint with the resulting signature.
  // Gig status remains 'expired'; this just records the on-chain refund for transaction history.
  fastify.post<{
    Params: RefundRoute['params']
    Body: RefundRoute['body']
    Reply: RefundRoute['response'] | ApiError
  }>(
    '/',
    { config: { rateLimit: { max: 3, timeWindow: '1 minute' } }, preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const { id } = request.params
      const { signature } = request.body

      if (!signature) {
        throw new AppError(400, ErrorCode.VALIDATION_ERROR, 'signature is required')
      }

      let gig = await ensureGigExists(fastify.db, id)

      // Lazily expire the gig if its deadlines have passed — so a poster who
      // hits this endpoint directly (without first opening the gig detail screen)
      // still gets the correct 'expired' status rather than a misleading 400.
      const config = await getPlatformConfig(fastify.db)
      gig = await checkAndExpireGig(gig, fastify.db, config.grace_period_seconds)

      ensureGigStatus(gig, 'expired')
      ensureGigOwnership(gig, request.user.id, 'poster')

      await ensureSignatureVerified(signature, 'refund_expired')

      const platform_fee_lamports = computePlatformFee(BigInt(gig.payment_lamports), config.fee_bps)

      try {
        await fastify.db.insert(gig_transactions).values({
          gig_id:               id,
          type:                 'expired_refund',
          signature,
          amount_lamports:      gig.payment_lamports,
          platform_fee_lamports,
        })
      } catch (err: unknown) {
        handleUniqueConflict(err, ErrorCode.DUPLICATE_SIGNATURE, 'This transaction signature has already been recorded')
      }

      return gig
    }
  )
}

export default refundExpired
