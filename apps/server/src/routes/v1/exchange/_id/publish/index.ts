import { FastifyPluginAsync } from 'fastify'
import { and, eq } from 'drizzle-orm'
import { exchange_offers, exchange_transactions } from '@tenda/shared/db/schema'
import { ErrorCode, computePlatformFee } from '@tenda/shared'
import { deriveEscrowAddress, ensureSignatureVerified, verifyEscrowFunded } from '@server/lib/solana'
import { getPlatformConfig } from '@server/lib/platform'
import {
  ensureOfferExists, ensureOfferOwnership, ensureOfferStatus, ensureOfferTxUpdated, buildOfferDetail,
} from '@server/lib/exchange'
import { handleUniqueConflict } from '@server/lib/db'
import { AppError } from '@server/lib/errors'
import type { ExchangeContract, ApiError } from '@tenda/shared'

type PublishRoute = ExchangeContract['publish']

const publishOffer: FastifyPluginAsync = async (fastify) => {
  // POST /v1/exchange/:id/publish — draft → open
  // Seller calls create_gig_escrow on Solana first, then posts the signature here.
  // Server derives the escrow PDA, verifies funding, and records the create_escrow transaction.
  fastify.post<{
    Params: PublishRoute['params']
    Body:   PublishRoute['body']
    Reply:  PublishRoute['response'] | ApiError
  }>(
    '/',
    { preHandler: [fastify.authenticate] },
    async (request, _reply) => {
      const { id } = request.params
      const { signature } = request.body

      if (!signature) {
        throw new AppError(400, ErrorCode.VALIDATION_ERROR, 'signature is required')
      }

      const offer = await ensureOfferExists(fastify.db, id)
      ensureOfferOwnership(offer, request.user.id, 'seller', 'Only the seller can publish this offer')
      ensureOfferStatus(offer, 'draft')

      if (offer.accept_deadline && new Date(offer.accept_deadline) <= new Date()) {
        throw new AppError(400, ErrorCode.ACCEPT_DEADLINE_PASSED, 'Cannot publish — acceptance deadline has already passed')
      }

      await ensureSignatureVerified(signature, 'create_gig_escrow')

      const [config] = await Promise.all([
        getPlatformConfig(fastify.db),
        verifyEscrowFunded(offer.id, request.user.wallet_address, BigInt(offer.lamports_amount)),
      ])

      const escrow_address = deriveEscrowAddress(offer.id)
      const effectiveFeeBps = request.user.is_seeker ? config.seeker_fee_bps : config.fee_bps
      const platform_fee_lamports = computePlatformFee(BigInt(offer.lamports_amount), effectiveFeeBps)

      let txResult
      try {
        txResult = await fastify.db.transaction(async (tx) => {
          // Include status = 'draft' in WHERE to guard against concurrent publish calls.
          const [updated] = await tx
            .update(exchange_offers)
            .set({ status: 'open', escrow_address, updated_at: new Date() })
            .where(and(eq(exchange_offers.id, id), eq(exchange_offers.status, 'draft')))
            .returning()

          if (!updated) return null

          await tx.insert(exchange_transactions).values({
            offer_id:              id,
            type:                  'create_escrow',
            signature,
            amount_lamports:       offer.lamports_amount + platform_fee_lamports,
            platform_fee_lamports: platform_fee_lamports,
          })

          return updated
        })
      } catch (err: unknown) {
        handleUniqueConflict(err, ErrorCode.DUPLICATE_SIGNATURE, 'This transaction signature has already been recorded')
      }

      const published = ensureOfferTxUpdated(txResult, 'Offer status changed — it may have already been published')

      return buildOfferDetail(fastify.db, published, request.user.id)
    }
  )
}

export default publishOffer
