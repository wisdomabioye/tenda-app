import { FastifyPluginAsync } from 'fastify'
import { ErrorCode } from '@tenda/shared'
import { buildSubmitProofInstruction } from '@server/lib/solana'
import { findOfferById } from '@server/lib/exchange'
import { AppError } from '@server/lib/errors'
import type { ExchangeBlockchainContract, ApiError } from '@tenda/shared'

type SubmitProofRoute = ExchangeBlockchainContract['submitProof']

const exchangeSubmitProof: FastifyPluginAsync = async (fastify) => {
  // POST /v1/blockchain/exchange-submit-proof
  // Builds an unsigned submit_proof instruction for the buyer to sign.
  // Caller must be the buyer and the offer must be in 'accepted' status.
  fastify.post<{
    Body: SubmitProofRoute['body']
    Reply: SubmitProofRoute['response'] | ApiError
  }>(
    '/exchange-submit-proof',
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

      if (offer.buyer_id !== request.user.id) {
        throw new AppError(403, ErrorCode.FORBIDDEN, 'Only the buyer can submit proof for this offer')
      }

      if (offer.status !== 'accepted') {
        throw new AppError(409, ErrorCode.GIG_WRONG_STATUS, `Offer must be in 'accepted' status (current: ${offer.status})`)
      }

      return buildSubmitProofInstruction(request.user.wallet_address, offer_id)
    }
  )
}

export default exchangeSubmitProof
