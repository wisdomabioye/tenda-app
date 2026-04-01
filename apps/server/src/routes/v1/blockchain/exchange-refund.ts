import { FastifyPluginAsync } from 'fastify'
import { ErrorCode } from '@tenda/shared'
import { buildRefundExpiredInstruction } from '@server/lib/solana'
import { ensureOfferExists, ensureOfferOwnership, ensureOfferStatus } from '@server/lib/exchange'
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

      const offer = await ensureOfferExists(fastify.db, offer_id)
      ensureOfferOwnership(offer, request.user.id, 'seller', 'Only the seller can claim a refund for this offer')
      ensureOfferStatus(offer, 'open', 'accepted')

      if (!offer.accept_deadline || new Date() <= new Date(offer.accept_deadline)) {
        throw new AppError(400, ErrorCode.VALIDATION_ERROR, 'Offer has not expired yet')
      }

      return buildRefundExpiredInstruction(request.user.wallet_address, offer_id)
    }
  )
}

export default exchangeRefund
