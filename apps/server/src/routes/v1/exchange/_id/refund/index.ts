import { FastifyPluginAsync } from 'fastify'
import { exchange_transactions } from '@tenda/shared/db/schema'
import { ErrorCode, computePlatformFee } from '@tenda/shared'
import { ensureSignatureVerified } from '@server/lib/solana'
import { getPlatformConfig } from '@server/lib/platform'
import { ensureOfferExists, ensureOfferOwnership, ensureOfferStatus, checkAndExpireOffer } from '@server/lib/exchange'
import { handleUniqueConflict } from '@server/lib/db'
import { AppError } from '@server/lib/errors'
import type { ExchangeContract, ApiError } from '@tenda/shared'

type RefundRoute = ExchangeContract['refund']

const exchangeRefund: FastifyPluginAsync = async (fastify) => {
  // POST /v1/exchange/:id/refund — seller records the expired-offer refund transaction in the DB.
  // Caller must first call POST /v1/blockchain/exchange-refund to get the unsigned tx,
  // sign + submit to Solana, then call this endpoint with the resulting signature.
  // Offer status remains 'expired'; this just records the on-chain refund for transaction history.
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

      let offer = await ensureOfferExists(fastify.db, id)

      // Lazily expire the offer if its deadlines have passed — so a seller who
      // hits this endpoint directly still gets the correct 'expired' status.
      offer = await checkAndExpireOffer(offer, fastify.db)

      ensureOfferStatus(offer, 'expired')
      ensureOfferOwnership(offer, request.user.id, 'seller')

      await ensureSignatureVerified(signature, 'refund_expired')

      const config = await getPlatformConfig(fastify.db)
      const effectiveFeeBps = request.user.is_seeker ? config.seeker_fee_bps : config.fee_bps
      const platform_fee_lamports = computePlatformFee(BigInt(offer.lamports_amount), effectiveFeeBps)

      try {
        await fastify.db.insert(exchange_transactions).values({
          offer_id:             id,
          type:                 'expired_refund',
          signature,
          amount_lamports:      offer.lamports_amount,
          platform_fee_lamports,
        })
      } catch (err: unknown) {
        handleUniqueConflict(err, ErrorCode.DUPLICATE_SIGNATURE, 'This transaction signature has already been recorded')
      }

      return reply.send(offer)
    },
  )
}

export default exchangeRefund
