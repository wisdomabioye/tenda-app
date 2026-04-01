import { FastifyPluginAsync } from 'fastify'
import { and, eq } from 'drizzle-orm'
import { exchange_offers, exchange_disputes, exchange_transactions, users } from '@tenda/shared/db/schema'
import { ErrorCode, computePlatformFee } from '@tenda/shared'
import { ensureSignatureVerified } from '@server/lib/solana'
import { getPlatformConfig } from '@server/lib/platform'
import { requireRole } from '@server/lib/guards'
import { isPostgresUniqueViolation } from '@server/lib/db'
import {
  ensureOfferExists, ensureOfferStatus, ensureOfferTxUpdated, buildOfferDetail,
} from '@server/lib/exchange'
import type { ExchangeContract, ApiError, ExchangeDisputeWinner } from '@tenda/shared'
import { AppError } from '@server/lib/errors'
import { appEvents } from '@server/lib/events'

type ResolveRoute = ExchangeContract['resolve']

const exchangeResolve: FastifyPluginAsync = async (fastify) => {
  // POST /v1/exchange/:id/resolve — admin resolves exchange dispute
  fastify.post<{
    Params: ResolveRoute['params']
    Body: ResolveRoute['body']
    Reply: ResolveRoute['response'] | ApiError
  }>(
    '/',
    { preHandler: [fastify.authenticate, requireRole('admin')] },
    async (request, reply) => {
      const { id } = request.params
      const { winner, signature, admin_note } = request.body

      if (!winner || !signature) {
        throw new AppError(400, ErrorCode.VALIDATION_ERROR, 'winner and signature are required')
      }

      // Validate winner
      const VALID_WINNERS: ExchangeDisputeWinner[] = ['seller', 'buyer', 'split']
      if (!VALID_WINNERS.includes(winner as ExchangeDisputeWinner)) {
        throw new AppError(400, ErrorCode.VALIDATION_ERROR, 'winner must be "seller", "buyer", or "split"')
      }

      const offer = await ensureOfferExists(fastify.db, id)
      ensureOfferStatus(offer, 'disputed')

      await ensureSignatureVerified(signature, 'resolve_dispute')

      const [config, sellerUser] = await Promise.all([
        getPlatformConfig(fastify.db),
        fastify.db
          .select({ is_seeker: users.is_seeker })
          .from(users)
          .where(eq(users.id, offer.seller_id))
          .limit(1),
      ])
      const effectiveFeeBps = sellerUser[0]?.is_seeker ? config.seeker_fee_bps : config.fee_bps
      const platform_fee_lamports = computePlatformFee(BigInt(offer.lamports_amount), effectiveFeeBps)
      const resolverWalletAddress = request.user.wallet_address
      const now = new Date()

      let updated
      try {
        updated = await fastify.db.transaction(async (tx) => {
          // TOCTOU guard: include status='disputed' in WHERE
          const [updatedOffer] = await tx
            .update(exchange_offers)
            .set({ status: 'resolved', updated_at: now })
            .where(and(eq(exchange_offers.id, id), eq(exchange_offers.status, 'disputed')))
            .returning()

          if (!updatedOffer) return null

          await tx
            .update(exchange_disputes)
            .set({
              winner:                  winner as ExchangeDisputeWinner,
              resolver_wallet_address: resolverWalletAddress,
              admin_note:              admin_note ?? null,
              resolved_at:             now,
            })
            .where(eq(exchange_disputes.offer_id, id))

          await tx.insert(exchange_transactions).values({
            offer_id:              id,
            type:                  'dispute_resolved',
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

      const resolved = ensureOfferTxUpdated(updated, 'Offer status changed — it may have already been resolved')

      appEvents.emit('exchange.resolved', {
        offerId:    id,
        sellerId:   offer.seller_id,
        buyerId:    offer.buyer_id!,
        winner,
        currency:   offer.fiat_currency,
        fiatAmount: offer.fiat_amount,
      })

      const detail = await buildOfferDetail(fastify.db, resolved, request.user.id)
      return reply.send(detail)
    }
  )
}

export default exchangeResolve
