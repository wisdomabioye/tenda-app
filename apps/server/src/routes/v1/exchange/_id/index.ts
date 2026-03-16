import { FastifyPluginAsync } from 'fastify'
import { eq, and } from 'drizzle-orm'
import { exchange_offers, exchange_transactions } from '@tenda/shared/db/schema'
import { ErrorCode, computePlatformFee } from '@tenda/shared'
import type { ExchangeContract, ApiError } from '@tenda/shared'
import { ensureSignatureVerified } from '@server/lib/solana'
import { getPlatformConfig } from '@server/lib/platform'
import { AppError } from '@server/lib/errors'
import {
  ensureOfferExists, ensureOfferOwnership, ensureOfferStatus, ensureOfferTxUpdated,
  buildOfferDetail, checkAndExpireOffer,
} from '@server/lib/exchange'
import { handleUniqueConflict } from '@server/lib/db'
import { appEvents } from '@server/lib/events'

type GetRoute    = ExchangeContract['get']
type UpdateRoute = ExchangeContract['update']
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

      const fetchedOffer = await ensureOfferExists(fastify.db, id)
      const offer = await checkAndExpireOffer(fetchedOffer, fastify.db)

      const detail = await buildOfferDetail(fastify.db, offer, request.user.id)
      return reply.send(detail)
    }
  )

  // PATCH /v1/exchange/:id — update a draft offer (seller only)
  fastify.patch<{
    Params: UpdateRoute['params']
    Body:   UpdateRoute['body']
    Reply:  UpdateRoute['response'] | ApiError
  }>(
    '/',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const { id } = request.params
      const { lamports_amount, fiat_amount, fiat_currency, rate, payment_window_seconds, accept_deadline, account_ids } = request.body

      const offer = await ensureOfferExists(fastify.db, id)
      ensureOfferOwnership(offer, request.user.id, 'seller', 'Only the seller can edit this offer')
      ensureOfferStatus(offer, 'draft')

      const [updated] = await fastify.db
        .update(exchange_offers)
        .set({
          ...(lamports_amount          != null && { lamports_amount: Number(lamports_amount) }),
          ...(fiat_amount              != null && { fiat_amount }),
          ...(fiat_currency            != null && { fiat_currency }),
          ...(rate                     != null && { rate }),
          ...(payment_window_seconds   != null && { payment_window_seconds }),
          ...(accept_deadline !== undefined    && { accept_deadline: accept_deadline ? new Date(accept_deadline) : null }),
          ...(account_ids              != null && { payment_account_ids: account_ids }),
          updated_at: new Date(),
        })
        .where(eq(exchange_offers.id, id))
        .returning()

      return reply.send(updated!)
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

      const offer = await ensureOfferExists(fastify.db, id)
      ensureOfferOwnership(offer, request.user.id, 'seller', 'Only the seller can cancel this offer')
      ensureOfferStatus(offer, 'draft', 'open')

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
              amount_lamports:       offer.lamports_amount + platform_fee_lamports,
              platform_fee_lamports: 0, // full refund — platform takes no fee on cancellation
            })

            return cancelled
          })
        } catch (err: unknown) {
          handleUniqueConflict(err, ErrorCode.DUPLICATE_SIGNATURE, 'This transaction signature has already been recorded')
        }

        const cancelledOpen = ensureOfferTxUpdated(txResult, 'Offer status changed — it may have already been accepted or cancelled')

        appEvents.emit('exchange.cancelled', {
          offerId:    id,
          sellerId:   offer.seller_id,
          buyerId:    offer.buyer_id,
          currency:   offer.fiat_currency,
          fiatAmount: offer.fiat_amount,
        })

        return reply.send(cancelledOpen)
      }

      // Draft cancellation — no escrow, no signature needed
      const [cancelled] = await fastify.db
        .update(exchange_offers)
        .set({ status: 'cancelled', updated_at: new Date() })
        .where(and(eq(exchange_offers.id, id), eq(exchange_offers.status, 'draft')))
        .returning()

      const cancelledDraft = ensureOfferTxUpdated(cancelled, 'Offer status changed — it may have already been published or cancelled')

      appEvents.emit('exchange.cancelled', {
        offerId:    id,
        sellerId:   offer.seller_id,
        buyerId:    offer.buyer_id,
        currency:   offer.fiat_currency,
        fiatAmount: offer.fiat_amount,
      })

      return reply.send(cancelledDraft)
    }
  )
}

export default exchangeById
