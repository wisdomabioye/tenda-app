import { FastifyPluginAsync } from 'fastify'
import { and, eq } from 'drizzle-orm'
import { exchange_offers, exchange_disputes, exchange_transactions } from '@tenda/shared/db/schema'
import { ErrorCode, EXCHANGE_DISPUTE_REASON_MIN_LENGTH, EXCHANGE_DISPUTE_REASON_MAX_LENGTH } from '@tenda/shared'
import { ensureSignatureVerified } from '@server/lib/solana'
import { buildOfferDetail } from '@server/lib/exchange'
import type { ExchangeContract, ApiError, ExchangeOffer } from '@tenda/shared'
import { AppError } from '@server/lib/errors'
import { appEvents } from '@server/lib/events'

type DisputeRoute = ExchangeContract['dispute']

const exchangeDispute: FastifyPluginAsync = async (fastify) => {
  // POST /v1/exchange/:id/dispute — seller or buyer raises a dispute
  fastify.post<{
    Params: DisputeRoute['params']
    Body: DisputeRoute['body']
    Reply: DisputeRoute['response'] | ApiError
  }>(
    '/',
    {
      preHandler: [fastify.authenticate],
      config: { rateLimit: { max: 3, timeWindow: '1 minute' } },
    },
    async (request, reply) => {
      const { id } = request.params
      const { reason, signature } = request.body

      if (!reason || !signature) {
        throw new AppError(400, ErrorCode.VALIDATION_ERROR, 'reason and signature are required')
      }

      if (reason.trim().length < EXCHANGE_DISPUTE_REASON_MIN_LENGTH) {
        throw new AppError(400, ErrorCode.VALIDATION_ERROR, `reason must be at least ${EXCHANGE_DISPUTE_REASON_MIN_LENGTH} characters`)
      }
      if (reason.length > EXCHANGE_DISPUTE_REASON_MAX_LENGTH) {
        throw new AppError(400, ErrorCode.VALIDATION_ERROR, `reason must be at most ${EXCHANGE_DISPUTE_REASON_MAX_LENGTH} characters`)
      }

      const [offer] = await fastify.db
        .select()
        .from(exchange_offers)
        .where(eq(exchange_offers.id, id))
        .limit(1)

      if (!offer) {
        throw new AppError(404, ErrorCode.NOT_FOUND, 'Exchange offer not found')
      }

      const isSeller = offer.seller_id === request.user.id
      const isBuyer  = offer.buyer_id === request.user.id

      if (!isSeller && !isBuyer) {
        throw new AppError(403, ErrorCode.FORBIDDEN, 'Only the seller or buyer can dispute this offer')
      }

      if (offer.status !== 'accepted' && offer.status !== 'paid') {
        throw new AppError(409, ErrorCode.GIG_WRONG_STATUS, 'Offer must be in accepted or paid status to dispute')
      }

      // Pre-check: does a dispute already exist?
      const [existingDispute] = await fastify.db
        .select({ id: exchange_disputes.id })
        .from(exchange_disputes)
        .where(eq(exchange_disputes.offer_id, id))
        .limit(1)

      if (existingDispute) {
        throw new AppError(409, ErrorCode.DISPUTE_ALREADY_EXISTS, 'A dispute already exists for this offer')
      }

      await ensureSignatureVerified(signature, 'dispute_gig')

      const now = new Date()

      const updated = await fastify.db.transaction(async (tx) => {
        // TOCTOU guard: only transition from accepted or paid
        // Use the offer's current status for the guard
        const statusGuard = offer.status as 'accepted' | 'paid'
        const [updatedOffer] = await tx
          .update(exchange_offers)
          .set({ status: 'disputed', updated_at: now })
          .where(and(eq(exchange_offers.id, id), eq(exchange_offers.status, statusGuard)))
          .returning()

        if (!updatedOffer) return null

        await tx.insert(exchange_disputes).values({
          offer_id:     id,
          opened_by_id: request.user.id,
          reason,
          raised_at:    now,
        })

        await tx.insert(exchange_transactions).values({
          offer_id:              id,
          type:                  'dispute_raised',
          signature,
          amount_lamports:       0n,
          platform_fee_lamports: 0n,
        })

        return updatedOffer
      })

      if (!updated) {
        throw new AppError(409, ErrorCode.GIG_WRONG_STATUS, 'Offer status changed — it may have already been disputed or completed')
      }

      appEvents.emit('exchange.disputed', {
        offerId:    id,
        sellerId:   offer.seller_id,
        buyerId:    offer.buyer_id!,
        raisedById: request.user.id,
        currency:   offer.fiat_currency,
        fiatAmount: offer.fiat_amount,
      })

      const detail = await buildOfferDetail(fastify.db, updated as ExchangeOffer, request.user.id)
      return reply.send(detail)
    }
  )
}

export default exchangeDispute
