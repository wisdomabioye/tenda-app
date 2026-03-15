import { FastifyPluginAsync } from 'fastify'
import { eq, and } from 'drizzle-orm'
import { exchange_offers, exchange_transactions } from '@tenda/shared/db/schema'
import { ErrorCode, computePlatformFee } from '@tenda/shared'
import type { ExchangeContract, ApiError } from '@tenda/shared'
import { ensureSignatureVerified } from '@server/lib/solana'
import { getPlatformConfig } from '@server/lib/platform'
import { AppError } from '@server/lib/errors'
import { buildOfferDetail, checkAndExpireOffer } from '@server/lib/exchange'
import { handleUniqueConflict } from '@server/lib/db'
import { appEvents } from '@server/lib/events'

type GetRoute    = ExchangeContract['get']
type CancelRoute = ExchangeContract['cancel']

const exchangeById: FastifyPluginAsync = async (fastify) => {

  // GET /v1/exchange/:id — get offer detail (auth required for payment detail visibility rules)
  fastify.get<{
    Params: GetRoute['params']
    Reply: GetRoute['response'] | ApiError
  }>(
    '/',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const { id } = request.params

      const [fetchedOffer] = await fastify.db
        .select()
        .from(exchange_offers)
        .where(eq(exchange_offers.id, id))
        .limit(1)

      if (!fetchedOffer) {
        throw new AppError(404, ErrorCode.NOT_FOUND, 'Exchange offer not found')
      }

      const offer = await checkAndExpireOffer(fetchedOffer, fastify.db)

      const detail = await buildOfferDetail(fastify.db, offer, request.user.id)
      return reply.send(detail)
    }
  )

  // DELETE /v1/exchange/:id — cancel offer (seller only)
  // draft: no escrow exists — just update status, no signature needed
  // open:  escrow is funded — requires on-chain cancel_gig signature to record refund
  fastify.delete<{
    Params: CancelRoute['params']
    Body:   CancelRoute['body']
    Reply:  CancelRoute['response'] | ApiError
  }>(
    '/',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const { id } = request.params
      const { signature } = request.body ?? {}

      const [offer] = await fastify.db
        .select()
        .from(exchange_offers)
        .where(eq(exchange_offers.id, id))
        .limit(1)

      if (!offer) {
        throw new AppError(404, ErrorCode.NOT_FOUND, 'Exchange offer not found')
      }

      if (offer.seller_id !== request.user.id) {
        throw new AppError(403, ErrorCode.FORBIDDEN, 'Only the seller can cancel this offer')
      }

      if (offer.status !== 'draft' && offer.status !== 'open') {
        throw new AppError(409, ErrorCode.GIG_WRONG_STATUS, 'Offer cannot be cancelled in its current state')
      }

      if (offer.status === 'open' && !signature) {
        throw new AppError(400, ErrorCode.VALIDATION_ERROR, 'signature is required when cancelling an open offer')
      }

      // Open offer: verify the cancel transaction on-chain before recording
      if (offer.status === 'open' && signature) {
        await ensureSignatureVerified(signature, 'cancel_gig')

        const config = await getPlatformConfig(fastify.db)
        const effectiveFeeBps = request.user.is_seeker ? config.seeker_fee_bps : config.fee_bps
        const platform_fee_lamports = computePlatformFee(BigInt(offer.lamports_amount), effectiveFeeBps)

        let txResult
        try {
          txResult = await fastify.db.transaction(async (tx) => {
            const [cancelled] = await tx
              .update(exchange_offers)
              .set({ status: 'cancelled', updated_at: new Date() })
              .where(and(eq(exchange_offers.id, id), eq(exchange_offers.status, 'open')))
              .returning()

            if (!cancelled) return null

            await tx.insert(exchange_transactions).values({
              offer_id:              id,
              type:                  'cancel_refund',
              signature,
              amount_lamports:       BigInt(offer.lamports_amount) + BigInt(platform_fee_lamports),
              platform_fee_lamports: 0n, // full refund — platform takes no fee on cancellation
            })

            return cancelled
          })
        } catch (err: unknown) {
          handleUniqueConflict(err, ErrorCode.DUPLICATE_SIGNATURE, 'This transaction signature has already been recorded')
        }

        if (!txResult) {
          throw new AppError(409, ErrorCode.GIG_WRONG_STATUS, 'Offer status changed — it may have already been accepted or cancelled')
        }

        appEvents.emit('exchange.cancelled', {
          offerId:    id,
          sellerId:   offer.seller_id,
          buyerId:    offer.buyer_id,
          currency:   offer.fiat_currency,
          fiatAmount: offer.fiat_amount,
        })

        return reply.send(txResult)
      }

      // Draft cancellation — no escrow, no signature needed
      const [cancelled] = await fastify.db
        .update(exchange_offers)
        .set({ status: 'cancelled', updated_at: new Date() })
        .where(and(eq(exchange_offers.id, id), eq(exchange_offers.status, 'draft')))
        .returning()

      if (!cancelled) {
        throw new AppError(409, ErrorCode.GIG_WRONG_STATUS, 'Offer status changed — it may have already been published or cancelled')
      }

      appEvents.emit('exchange.cancelled', {
        offerId:    id,
        sellerId:   offer.seller_id,
        buyerId:    offer.buyer_id,
        currency:   offer.fiat_currency,
        fiatAmount: offer.fiat_amount,
      })

      return reply.send(cancelled)
    }
  )
}

export default exchangeById
