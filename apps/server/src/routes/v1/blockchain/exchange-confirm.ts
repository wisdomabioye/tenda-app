import { FastifyPluginAsync } from 'fastify'
import { eq } from 'drizzle-orm'
import { users } from '@tenda/shared/db/schema'
import { ErrorCode } from '@tenda/shared'
import { buildApproveCompletionInstruction } from '@server/lib/solana'
import { findOfferById } from '@server/lib/exchange'
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

      const offer = await findOfferById(fastify.db, offer_id)

      if (!offer) {
        throw new AppError(404, ErrorCode.NOT_FOUND, 'Exchange offer not found')
      }

      if (offer.seller_id !== request.user.id) {
        throw new AppError(403, ErrorCode.FORBIDDEN, 'Only the seller can confirm this offer')
      }

      if (offer.status !== 'paid') {
        throw new AppError(409, ErrorCode.GIG_WRONG_STATUS, `Offer must be in 'paid' status (current: ${offer.status})`)
      }

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
