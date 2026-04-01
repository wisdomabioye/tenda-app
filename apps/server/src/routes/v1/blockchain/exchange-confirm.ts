import { FastifyPluginAsync } from 'fastify'
import { eq } from 'drizzle-orm'
import { users } from '@tenda/shared/db/schema'
import { ErrorCode } from '@tenda/shared'
import { buildApproveCompletionInstruction } from '@server/lib/solana'
import { ensureOfferExists, ensureOfferOwnership, ensureOfferStatus } from '@server/lib/exchange'
import { AppError } from '@server/lib/errors'
import { getConfig } from '@server/config'
import type { ExchangeBlockchainContract, ApiError } from '@tenda/shared'

type ConfirmRoute = ExchangeBlockchainContract['confirm']

const exchangeConfirm: FastifyPluginAsync = async (fastify) => {
  // POST /v1/blockchain/exchange-confirm
  // Builds an unsigned approve_completion instruction for the seller to sign.
  // Caller must be the seller and the offer must be in 'paid' status.
  fastify.post<{
    Body: ConfirmRoute['body']
    Reply: ConfirmRoute['response'] | ApiError
  }>(
    '/exchange-confirm',
    { preHandler: [fastify.authenticate] },
    async (request, _reply) => {
      const { offer_id } = request.body

      if (!offer_id) {
        throw new AppError(400, ErrorCode.VALIDATION_ERROR, 'offer_id is required')
      }

      const offer = await ensureOfferExists(fastify.db, offer_id)
      ensureOfferOwnership(offer, request.user.id, 'seller', 'Only the seller can confirm this offer')
      ensureOfferStatus(offer, 'paid')
      
      if (!offer.buyer_id) {
        throw new AppError(400, ErrorCode.VALIDATION_ERROR, 'Offer has no buyer')
      }

      const [buyer] = await fastify.db
        .select({ wallet_address: users.wallet_address })
        .from(users)
        .where(eq(users.id, offer.buyer_id))
        .limit(1)

      if (!buyer) {
        throw new AppError(404, ErrorCode.USER_NOT_FOUND, 'Buyer not found')
      }

      return buildApproveCompletionInstruction(
        request.user.wallet_address,
        buyer.wallet_address,
        offer_id,
        getConfig().SOLANA_TREASURY_ADDRESS,
      )
    }
  )
}

export default exchangeConfirm
