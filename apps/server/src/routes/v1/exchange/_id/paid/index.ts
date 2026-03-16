import { FastifyPluginAsync } from 'fastify'
import { and, eq } from 'drizzle-orm'
import { exchange_offers, exchange_proofs, exchange_transactions } from '@tenda/shared/db/schema'
import { ErrorCode } from '@tenda/shared'
import { ensureSignatureVerified } from '@server/lib/solana'
import { isPostgresUniqueViolation } from '@server/lib/db'
import {
  ensureOfferExists, ensureOfferOwnership, ensureOfferStatus, ensureOfferTxUpdated, buildOfferDetail,
} from '@server/lib/exchange'
import type { ExchangeContract, ApiError } from '@tenda/shared'
import { AppError } from '@server/lib/errors'
import { validateProofs } from '@server/lib/proofs'
import { appEvents } from '@server/lib/events'

type PaidRoute = ExchangeContract['paid']

const exchangePaid: FastifyPluginAsync = async (fastify) => {
  // POST /v1/exchange/:id/paid — buyer marks offer as paid and uploads proof
  fastify.post<{
    Params: PaidRoute['params']
    Body: PaidRoute['body']
    Reply: PaidRoute['response'] | ApiError
  }>(
    '/',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const { id } = request.params
      const { proofs, signature } = request.body

      if (!signature || !proofs) {
        throw new AppError(400, ErrorCode.VALIDATION_ERROR, 'signature and proofs are required')
      }

      if (!Array.isArray(proofs) || proofs.length === 0 || proofs.length > 10) {
        throw new AppError(400, ErrorCode.VALIDATION_ERROR, 'proofs must be an array of 1–10 items')
      }

      validateProofs(proofs, request.user.id, 10)

      const offer = await ensureOfferExists(fastify.db, id)
      ensureOfferOwnership(offer, request.user.id, 'buyer', 'Only the buyer can mark this offer as paid')
      ensureOfferStatus(offer, 'accepted')

      await ensureSignatureVerified(signature, 'submit_proof')

      const now = new Date()

      let updated
      try {
        updated = await fastify.db.transaction(async (tx) => {
          // TOCTOU guard: include status='accepted' in WHERE
          const [updatedOffer] = await tx
            .update(exchange_offers)
            .set({ status: 'paid', paid_at: now, updated_at: now })
            .where(and(eq(exchange_offers.id, id), eq(exchange_offers.status, 'accepted')))
            .returning()

          if (!updatedOffer) return null

          await tx.insert(exchange_proofs).values(
            proofs.map((p) => ({
              offer_id:       id,
              uploaded_by_id: request.user.id,
              url:            p.url,
              type:           p.type,
            }))
          )

          // Record the on-chain signature so it's auditable and the unique
          // constraint prevents duplicate paid submissions.
          await tx.insert(exchange_transactions).values({
            offer_id:              id,
            type:                  'mark_paid',
            signature,
            amount_lamports:       0, // no SOL moves at this step; submit_proof only updates escrow state
            platform_fee_lamports: 0,
          })

          return updatedOffer
        })
      } catch (err: unknown) {
        if (isPostgresUniqueViolation(err)) {
          throw new AppError(409, ErrorCode.DUPLICATE_SIGNATURE, 'This transaction signature has already been recorded')
        }
        throw err
      }

      const paid = ensureOfferTxUpdated(updated, 'Offer status changed — it may have already been marked paid or disputed')

      appEvents.emit('exchange.paid', {
        offerId:    id,
        sellerId:   offer.seller_id,
        buyerId:    request.user.id,
        currency:   offer.fiat_currency,
        fiatAmount: offer.fiat_amount,
      })

      const detail = await buildOfferDetail(fastify.db, paid, request.user.id)
      return reply.send(detail)
    }
  )
}

export default exchangePaid
