import { FastifyPluginAsync } from 'fastify'
import { or, eq, desc, and } from 'drizzle-orm'
import {
  gigs, gig_transactions, disputes,
  exchange_offers, exchange_transactions, exchange_disputes,
} from '@tenda/shared/db/schema'
import { ErrorCode, MAX_PAGINATION_LIMIT } from '@tenda/shared'
import type { UsersContract, ApiError } from '@tenda/shared'
import { AppError } from '@server/lib/errors'

type TransactionsRoute = UsersContract['transactions']

const userTransactions: FastifyPluginAsync = async (fastify) => {
  // GET /v1/users/:id/transactions — gig + exchange transactions where the user is
  // a participant (poster/worker for gigs, seller/buyer for exchange).
  // Returns a merged, descending-chronological list for the wallet screen.
  // User-bounded result set (no DB-level limit needed per query before merge).
  fastify.get<{
    Params:      TransactionsRoute['params']
    Querystring: TransactionsRoute['query']
    Reply:       TransactionsRoute['response'] | ApiError
  }>('/', { preHandler: [fastify.authenticate] }, async (request) => {
    const { id } = request.params

    if (id !== request.user.id) throw new AppError(403, ErrorCode.FORBIDDEN, 'Can only fetch your own transactions')

    const { limit = 20, offset = 0 } = request.query
    const safeLimit  = Math.min(Number(limit),  MAX_PAGINATION_LIMIT)
    const safeOffset = Number(offset)

    // Each query fetches at most (safeOffset + safeLimit) rows — the maximum needed
    // to produce a correct page after the in-memory merge+sort.
    // e.g. offset=40, limit=20 → fetch 60 from each side (120 rows total in memory).
    const perQueryLimit = safeOffset + safeLimit

    const [gigRows, exchangeRows] = await Promise.all([
      // ── Gig transactions ───────────────────────────────────────────────
      // LEFT JOIN disputes only for dispute_resolved rows to get the winner.
      fastify.db
        .select({
          id:                    gig_transactions.id,
          gig_id:                gig_transactions.gig_id,
          type:                  gig_transactions.type,
          signature:             gig_transactions.signature,
          amount_lamports:       gig_transactions.amount_lamports,
          platform_fee_lamports: gig_transactions.platform_fee_lamports,
          created_at:            gig_transactions.created_at,
          gig_title:             gigs.title,
          gig_status:            gigs.status,
          gig_payment_lamports:  gigs.payment_lamports,
          gig_poster_id:         gigs.poster_id,
          gig_worker_id:         gigs.worker_id,
          dispute_winner:        disputes.winner,
        })
        .from(gig_transactions)
        .innerJoin(gigs, eq(gig_transactions.gig_id, gigs.id))
        .leftJoin(disputes, and(
          eq(disputes.gig_id, gig_transactions.gig_id),
          eq(gig_transactions.type, 'dispute_resolved'),
        ))
        .where(or(eq(gigs.poster_id, id), eq(gigs.worker_id, id)))
        .orderBy(desc(gig_transactions.created_at))
        .limit(perQueryLimit),

      // ── Exchange transactions ──────────────────────────────────────────
      // LEFT JOIN exchange_disputes only for dispute_resolved rows to get the winner.
      fastify.db
        .select({
          id:                    exchange_transactions.id,
          offer_id:              exchange_transactions.offer_id,
          type:                  exchange_transactions.type,
          signature:             exchange_transactions.signature,
          amount_lamports:       exchange_transactions.amount_lamports,
          platform_fee_lamports: exchange_transactions.platform_fee_lamports,
          created_at:            exchange_transactions.created_at,
          offer_fiat_amount:     exchange_offers.fiat_amount,
          offer_fiat_currency:   exchange_offers.fiat_currency,
          offer_lamports_amount: exchange_offers.lamports_amount,
          offer_seller_id:       exchange_offers.seller_id,
          offer_buyer_id:        exchange_offers.buyer_id,
          dispute_winner:        exchange_disputes.winner,
        })
        .from(exchange_transactions)
        .innerJoin(exchange_offers, eq(exchange_transactions.offer_id, exchange_offers.id))
        .leftJoin(exchange_disputes, and(
          eq(exchange_disputes.offer_id, exchange_transactions.offer_id),
          eq(exchange_transactions.type, 'dispute_resolved'),
        ))
        .where(or(eq(exchange_offers.seller_id, id), eq(exchange_offers.buyer_id, id)))
        .orderBy(desc(exchange_transactions.created_at))
        .limit(perQueryLimit),
    ])

    const gigMapped = gigRows.map((row) => ({
      source:                'gig' as const,
      id:                    row.id,
      gig_id:                row.gig_id,
      type:                  row.type,
      signature:             row.signature,
      amount_lamports:       row.amount_lamports,
      platform_fee_lamports: row.platform_fee_lamports,
      created_at:            row.created_at ? row.created_at.toISOString() : null,
      winner:                row.dispute_winner ?? null,
      gig: {
        id:               row.gig_id,
        title:            row.gig_title,
        status:           row.gig_status,
        payment_lamports: row.gig_payment_lamports,
        poster_id:        row.gig_poster_id,
        worker_id:        row.gig_worker_id,
      },
    }))

    const exchangeMapped = exchangeRows.map((row) => ({
      source:                'exchange' as const,
      id:                    row.id,
      offer_id:              row.offer_id,
      type:                  row.type,
      signature:             row.signature,
      amount_lamports:       row.amount_lamports,
      platform_fee_lamports: row.platform_fee_lamports,
      created_at:            row.created_at ? row.created_at.toISOString() : null,
      winner:                row.dispute_winner ?? null,
      offer: {
        id:              row.offer_id,
        fiat_amount:     row.offer_fiat_amount,
        fiat_currency:   row.offer_fiat_currency,
        lamports_amount: row.offer_lamports_amount,
        seller_id:       row.offer_seller_id,
        buyer_id:        row.offer_buyer_id,
      },
    }))

    // Merge and sort descending by created_at, then slice the requested page.
    const merged = [...gigMapped, ...exchangeMapped].sort((a, b) => {
      const ta = a.created_at ? new Date(a.created_at).getTime() : 0
      const tb = b.created_at ? new Date(b.created_at).getTime() : 0
      return tb - ta
    })

    const page = merged.slice(safeOffset, safeOffset + safeLimit)

    return {
      data:     page,
      total:    merged.length,  // lower-bound count (capped at 2 × perQueryLimit)
      has_more: page.length === safeLimit && merged.length === perQueryLimit * 2,
      limit:    safeLimit,
      offset:   safeOffset,
    }
  })
}

export default userTransactions
