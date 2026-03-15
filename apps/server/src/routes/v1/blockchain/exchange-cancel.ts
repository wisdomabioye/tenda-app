import { FastifyPluginAsync } from 'fastify'
import { ErrorCode } from '@tenda/shared'
import { buildCancelGigInstruction } from '@server/lib/solana'
import { findOfferById } from '@server/lib/exchange'
import { AppError } from '@server/lib/errors'
import type { ExchangeBlockchainContract, ApiError } from '@tenda/shared'

type CancelRoute = ExchangeBlockchainContract['cancel']

const exchangeCancel: FastifyPluginAsync = async (fastify) => {
  // POST /v1/blockchain/exchange-cancel
  // Builds an unsigned cancel_gig instruction for the seller to sign.
  // Caller must be the seller; offer must be in 'open' status.
  fastify.post<{
    Body: CancelRoute['body']
    Reply: CancelRoute['response'] | ApiError
  }>(
    '/exchange-cancel',
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
        throw new AppError(403, ErrorCode.FORBIDDEN, 'Only the seller can cancel this offer')
      }

      if (offer.status !== 'open') {
        throw new AppError(409, ErrorCode.GIG_WRONG_STATUS, `Offer must be in 'open' status to cancel (current: ${offer.status})`)
      }

      return buildCancelGigInstruction(request.user.wallet_address, offer_id)
    }
  )
}

export default exchangeCancel
