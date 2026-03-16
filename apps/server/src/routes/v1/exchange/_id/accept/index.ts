import { FastifyPluginAsync } from 'fastify'
import { and, eq } from 'drizzle-orm'
import { exchange_offers, exchange_transactions } from '@tenda/shared/db/schema'
import { ErrorCode } from '@tenda/shared'
import { ensureSignatureVerified } from '@server/lib/solana'
import {
  ensureOfferExists, ensureOfferStatus, ensureOfferTxUpdated, buildOfferDetail,
} from '@server/lib/exchange'
import type { ExchangeContract, ApiError } from '@tenda/shared'
import { AppError } from '@server/lib/errors'
import { handleUniqueConflict } from '@server/lib/db'
import { appEvents } from '@server/lib/events'

type AcceptRoute = ExchangeContract['accept']

const exchangeAccept: FastifyPluginAsync = async (fastify) => {
  // POST /v1/exchange/:id/accept — buyer accepts offer and records on-chain signature
  fastify.post<{
    Params: AcceptRoute['params']
    Body: AcceptRoute['body']
    Reply: AcceptRoute['response'] | ApiError
  }>(
    '/',
    { preHandler: [fastify.authenticate], config: { rateLimit: { max: 5, timeWindow: '1 minute' } } },
    async (request, reply) => {
      const { id } = request.params
      const { signature } = request.body

      if (!signature) {
        throw new AppError(400, ErrorCode.VALIDATION_ERROR, 'signature is required')
      }

      const offer = await ensureOfferExists(fastify.db, id)

      if (offer.seller_id === request.user.id) {
        throw new AppError(400, ErrorCode.CANNOT_ACCEPT_OWN_GIG, 'Cannot accept your own exchange offer')
      }

      ensureOfferStatus(offer, 'open')

      if (offer.accept_deadline && new Date() > new Date(offer.accept_deadline)) {
        throw new AppError(400, ErrorCode.ACCEPT_DEADLINE_PASSED, 'Acceptance deadline has passed')
      }

      await ensureSignatureVerified(signature, 'accept_gig')

      const now = new Date()

      let updated
      try {
        updated = await fastify.db.transaction(async (tx) => {
          // TOCTOU guard: include status='open' in WHERE
          const [updatedOffer] = await tx
            .update(exchange_offers)
            .set({
              buyer_id:    request.user.id,
              status:      'accepted',
              accepted_at: now,
              updated_at:  now,
            })
            .where(and(eq(exchange_offers.id, id), eq(exchange_offers.status, 'open')))
            .returning()

          if (!updatedOffer) return null

          await tx.insert(exchange_transactions).values({
            offer_id:              id,
            type:                  'accept',
            signature,
            amount_lamports:       offer.lamports_amount,
            platform_fee_lamports: 0,
          })

          return updatedOffer
        })
      } catch (err: unknown) {
        handleUniqueConflict(err, ErrorCode.DUPLICATE_SIGNATURE, 'This transaction signature has already been recorded')
      }

      const accepted = ensureOfferTxUpdated(updated, 'Offer is no longer open — it may have just been accepted by another buyer')

      appEvents.emit('exchange.accepted', {
        offerId:    id,
        sellerId:   offer.seller_id,
        buyerId:    request.user.id,
        currency:   offer.fiat_currency,
        fiatAmount: offer.fiat_amount,
      })

      const detail = await buildOfferDetail(fastify.db, accepted, request.user.id)
      return reply.send(detail)
    }
  )
}

export default exchangeAccept
