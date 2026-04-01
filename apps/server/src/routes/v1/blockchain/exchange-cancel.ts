import { FastifyPluginAsync } from 'fastify'
import { ErrorCode } from '@tenda/shared'
import { buildCancelGigInstruction } from '@server/lib/solana'
import { ensureOfferExists, ensureOfferOwnership, ensureOfferStatus } from '@server/lib/exchange'
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

      const offer = await ensureOfferExists(fastify.db, offer_id)
      ensureOfferOwnership(offer, request.user.id, 'seller', 'Only the seller can cancel this gig')
      ensureOfferStatus(offer, 'open', 'expired');
      
      try {
        return buildCancelGigInstruction(request.user.wallet_address, offer_id)
      } catch {
        throw new AppError(500, ErrorCode.INTERNAL_ERROR, 'Failed to build cancel instruction')
      }
    }
  )
}

export default exchangeCancel
