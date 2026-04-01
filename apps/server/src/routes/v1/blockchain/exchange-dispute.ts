import { FastifyPluginAsync } from 'fastify'
import { ErrorCode } from '@tenda/shared'
import { buildDisputeGigInstruction } from '@server/lib/solana'
import { ensureOfferExists, ensureOfferStatus } from '@server/lib/exchange'
import { AppError } from '@server/lib/errors'
import type { ExchangeBlockchainContract, ApiError } from '@tenda/shared'

type DisputeRoute = ExchangeBlockchainContract['dispute']

const exchangeDispute: FastifyPluginAsync = async (fastify) => {
  // POST /v1/blockchain/exchange-dispute
  // Builds an unsigned dispute_gig instruction for the seller or buyer to sign.
  // Offer must be in 'accepted' or 'paid' status.
  fastify.post<{
    Body: DisputeRoute['body']
    Reply: DisputeRoute['response'] | ApiError
  }>(
    '/exchange-dispute',
    { preHandler: [fastify.authenticate] },
    async (request, _reply) => {
      const { offer_id, reason } = request.body

      if (!offer_id || !reason) {
        throw new AppError(400, ErrorCode.VALIDATION_ERROR, 'offer_id and reason are required')
      }

      const offer = await ensureOfferExists(fastify.db, offer_id)
      ensureOfferStatus(offer, 'accepted', 'paid')

      if (offer.seller_id !== request.user.id && offer.buyer_id !== request.user.id) {
        throw new AppError(403, ErrorCode.FORBIDDEN, 'Only the seller or buyer can dispute this offer')
      }

      return buildDisputeGigInstruction(request.user.wallet_address, offer_id, reason)
    }
  )
}

export default exchangeDispute
