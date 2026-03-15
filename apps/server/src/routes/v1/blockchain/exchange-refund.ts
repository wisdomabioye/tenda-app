import { FastifyPluginAsync } from 'fastify'
import { ErrorCode } from '@tenda/shared'
import { buildRefundExpiredInstruction } from '@server/lib/solana'
import { findOfferById } from '@server/lib/exchange'
import { AppError } from '@server/lib/errors'
import type { ExchangeBlockchainContract, ApiError } from '@tenda/shared'

type RefundRoute = ExchangeBlockchainContract['refund']

const exchangeRefund: FastifyPluginAsync = async (fastify) => {
  // POST /v1/blockchain/exchange-refund
  // Builds an unsigned refund_expired instruction for the seller to sign.
  // Offer must be expired (accept_deadline passed) and in 'open' or 'accepted' status.
  fastify.post<{
    Body: RefundRoute['body']
    Reply: RefundRoute['response'] | ApiError
  }>(
    '/exchange-refund',
    { preHandler: [fastify.authenticate] },
    async (request, _reply) => {
      const { offer_id } = request.body

      if (!offer_id) {
        throw new AppError(400, ErrorCode.VALIDATION_ERROR, 'offer_id is required')
      }

      const offer = await findOfferById(fastify.db, offer_id)

      if (!offer) {
        throw new AppError(404, ErrorCode.NOT_FOUND, 'Exchange offer not found')
      }

      if (offer.seller_id !== request.user.id) {
        throw new AppError(403, ErrorCode.FORBIDDEN, 'Only the seller can claim a refund for this offer')
      }

      if (offer.status !== 'open' && offer.status !== 'accepted') {
        throw new AppError(409, ErrorCode.GIG_WRONG_STATUS, `Offer must be in 'open' or 'accepted' status to refund (current: ${offer.status})`)
      }

      if (!offer.accept_deadline || new Date() <= new Date(offer.accept_deadline)) {
        throw new AppError(400, ErrorCode.VALIDATION_ERROR, 'Offer has not expired yet')
      }

      return buildRefundExpiredInstruction(request.user.wallet_address, offer_id)
    }
  )
}

export default exchangeRefund
