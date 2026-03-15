import { FastifyPluginAsync } from 'fastify'
import { ErrorCode } from '@tenda/shared'
import { buildDisputeGigInstruction } from '@server/lib/solana'
import { findOfferById } from '@server/lib/exchange'
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

      const offer = await findOfferById(fastify.db, offer_id)

      if (!offer) {
        throw new AppError(404, ErrorCode.NOT_FOUND, 'Exchange offer not found')
      }

      if (offer.seller_id !== request.user.id && offer.buyer_id !== request.user.id) {
        throw new AppError(403, ErrorCode.FORBIDDEN, 'Only the seller or buyer can dispute this offer')
      }

      if (offer.status !== 'accepted' && offer.status !== 'paid') {
        throw new AppError(409, ErrorCode.GIG_WRONG_STATUS, `Offer must be in 'accepted' or 'paid' status to dispute (current: ${offer.status})`)
      }

      return buildDisputeGigInstruction(request.user.wallet_address, offer_id, reason)
    }
  )
}

export default exchangeDispute
