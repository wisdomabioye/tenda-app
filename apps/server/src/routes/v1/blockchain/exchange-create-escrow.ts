import { FastifyPluginAsync } from 'fastify'
import { ErrorCode } from '@tenda/shared'
import { buildCreateGigEscrowInstruction } from '@server/lib/solana'
import { ensureOfferExists, ensureOfferOwnership, ensureOfferStatus } from '@server/lib/exchange'
import { AppError } from '@server/lib/errors'
import type { ExchangeBlockchainContract, ApiError } from '@tenda/shared'

type CreateEscrowRoute = ExchangeBlockchainContract['createEscrow']

const exchangeCreateEscrow: FastifyPluginAsync = async (fastify) => {
  // POST /v1/blockchain/exchange-create-escrow
  // Builds an unsigned create_gig_escrow instruction for the seller to sign.
  // Caller must be the seller and the offer must be in 'open' status.
  fastify.post<{
    Body: CreateEscrowRoute['body']
    Reply: CreateEscrowRoute['response'] | ApiError
  }>(
    '/exchange-create-escrow',
    { preHandler: [fastify.authenticate] },
    async (request, _reply) => {
      const { offer_id } = request.body

      if (!offer_id) {
        throw new AppError(400, ErrorCode.VALIDATION_ERROR, 'offer_id is required')
      }

      const offer = await ensureOfferExists(fastify.db, offer_id)
      ensureOfferOwnership(offer, request.user.id, 'seller', 'Only the seller can create escrow for this offer')
      ensureOfferStatus(offer, 'draft')

      return buildCreateGigEscrowInstruction(
        request.user.wallet_address,
        offer_id,
        BigInt(offer.lamports_amount),
        offer.payment_window_seconds,
        offer.accept_deadline ? new Date(offer.accept_deadline) : null,
        request.user.is_seeker,
      )
    }
  )
}

export default exchangeCreateEscrow
