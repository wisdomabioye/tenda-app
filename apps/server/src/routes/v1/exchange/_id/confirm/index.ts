import { FastifyPluginAsync } from 'fastify'
import { and, eq } from 'drizzle-orm'
import { exchange_offers, exchange_transactions } from '@tenda/shared/db/schema'
import { ErrorCode, computePlatformFee } from '@tenda/shared'
import { ensureSignatureVerified } from '@server/lib/solana'
import { getPlatformConfig } from '@server/lib/platform'
import { isPostgresUniqueViolation } from '@server/lib/db'
import { buildOfferDetail } from '@server/lib/exchange'
import type { ExchangeContract, ApiError } from '@tenda/shared'
import { AppError } from '@server/lib/errors'
import { appEvents } from '@server/lib/events'

type ConfirmRoute = ExchangeContract['confirm']

const exchangeConfirm: FastifyPluginAsync = async (fastify) => {
  // POST /v1/exchange/:id/confirm — seller confirms receipt of fiat payment, releases SOL
  fastify.post<{
    Params: ConfirmRoute['params']
    Body: ConfirmRoute['body']
    Reply: ConfirmRoute['response'] | ApiError
  }>(
    '/',
    { preHandler: [fastify.authenticate], config: { rateLimit: { max: 5, timeWindow: '1 minute' } } },
    async (request, reply) => {
      const { id } = request.params
      const { signature } = request.body

      if (!signature) {
        throw new AppError(400, ErrorCode.VALIDATION_ERROR, 'signature is required')
      }

      const [offer] = await fastify.db
        .select()
        .from(exchange_offers)
        .where(eq(exchange_offers.id, id))
        .limit(1)

      if (!offer) {
        throw new AppError(404, ErrorCode.NOT_FOUND, 'Exchange offer not found')
      }

      if (offer.seller_id !== request.user.id) {
        throw new AppError(403, ErrorCode.FORBIDDEN, 'Only the seller can confirm this offer')
      }

      if (offer.status !== 'paid') {
        throw new AppError(409, ErrorCode.GIG_WRONG_STATUS, 'Offer must be in paid status to confirm')
      }

      await ensureSignatureVerified(signature, 'approve_completion')

      const config = await getPlatformConfig(fastify.db)
      const effectiveFeeBps = request.user.is_seeker ? config.seeker_fee_bps : config.fee_bps
      const platform_fee_lamports = BigInt(computePlatformFee(offer.lamports_amount, effectiveFeeBps))
      const now = new Date()

      let updated
      try {
        updated = await fastify.db.transaction(async (tx) => {
          // TOCTOU guard: include status='paid' in WHERE
          const [updatedOffer] = await tx
            .update(exchange_offers)
            .set({ status: 'completed', completed_at: now, updated_at: now })
            .where(and(eq(exchange_offers.id, id), eq(exchange_offers.status, 'paid')))
            .returning()

          if (!updatedOffer) return null

          await tx.insert(exchange_transactions).values({
            offer_id:              id,
            type:                  'release_payment',
            signature,
            amount_lamports:       offer.lamports_amount,
            platform_fee_lamports,
          })

          return updatedOffer
        })
      } catch (err: unknown) {
        if (isPostgresUniqueViolation(err)) {
          throw new AppError(409, ErrorCode.DUPLICATE_SIGNATURE, 'This transaction signature has already been recorded')
        }
        throw err
      }

      if (!updated) {
        throw new AppError(409, ErrorCode.GIG_WRONG_STATUS, 'Offer status changed — it may have already been completed or disputed')
      }

      appEvents.emit('exchange.confirmed', {
        offerId:    id,
        sellerId:   request.user.id,
        buyerId:    offer.buyer_id!,
        currency:   offer.fiat_currency,
        fiatAmount: offer.fiat_amount,
      })

      const detail = await buildOfferDetail(fastify.db, updated, request.user.id)
      return reply.send(detail)
    }
  )
}

export default exchangeConfirm
