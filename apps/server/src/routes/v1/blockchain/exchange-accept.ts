import { FastifyPluginAsync } from 'fastify'
import { ErrorCode } from '@tenda/shared'
import { buildAcceptGigInstruction, buildCreateUserAccountInstruction, userAccountExists } from '@server/lib/solana'
import { ensureOfferExists, ensureOfferStatus } from '@server/lib/exchange'
import { AppError } from '@server/lib/errors'
import type { ExchangeBlockchainContract, ApiError } from '@tenda/shared'

type AcceptRoute = ExchangeBlockchainContract['accept']

const exchangeAccept: FastifyPluginAsync = async (fastify) => {
  // POST /v1/blockchain/exchange-accept
  // Builds an unsigned accept_gig instruction for the buyer to sign.
  // Caller must not be the seller and the offer must be in 'open' status.
  fastify.post<{
    Body: AcceptRoute['body']
    Reply: AcceptRoute['response'] | ApiError
  }>(
    '/exchange-accept',
    { preHandler: [fastify.authenticate] },
    async (request, _reply) => {
      const { offer_id } = request.body

      if (!offer_id) {
        throw new AppError(400, ErrorCode.VALIDATION_ERROR, 'offer_id is required')
      }

      const offer = await ensureOfferExists(fastify.db, offer_id)
      ensureOfferStatus(offer, 'open')

      if (offer.seller_id === request.user.id) {
        throw new AppError(400, ErrorCode.CANNOT_ACCEPT_OWN_GIG, 'Cannot accept your own exchange offer')
      }

      if (offer.accept_deadline && new Date() > new Date(offer.accept_deadline)) {
        throw new AppError(400, ErrorCode.ACCEPT_DEADLINE_PASSED, 'Acceptance deadline has passed')
      }

      const [acceptResult, accountExists] = await Promise.all([
        buildAcceptGigInstruction(request.user.wallet_address, offer_id),
        userAccountExists(request.user.wallet_address),
      ])

      if (accountExists) {
        return acceptResult
      }

      // Buyer has no on-chain UserAccount yet — include a setup transaction.
      const { transaction: setup_transaction } = await buildCreateUserAccountInstruction(
        request.user.wallet_address,
      )
      return { ...acceptResult, setup_transaction }
    }
  )
}

export default exchangeAccept
