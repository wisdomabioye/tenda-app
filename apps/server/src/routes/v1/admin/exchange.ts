import { FastifyPluginAsync } from 'fastify'
import { eq, and, desc, sql, SQL, inArray } from 'drizzle-orm'
import {
  exchange_offers, exchange_disputes, exchange_proofs,
  user_exchange_accounts, users, reviews,
} from '@tenda/shared/db/schema'
import { ErrorCode, MAX_PAGINATION_LIMIT } from '@tenda/shared'
import { requireRole } from '@server/lib/guards'
import type { ApiError, ExchangeOfferStatus } from '@tenda/shared'
import { AppError } from '@server/lib/errors'
import { ensureOfferExists } from '@server/lib/exchange'
import { appEvents } from '@server/lib/events'


// hide/unhide: support, moderator, super_admin (same as gig moderation)
const MODERATION_ROLES = ['support', 'moderator', 'super_admin'] as const

const adminExchange: FastifyPluginAsync = async (fastify) => {
  // GET /v1/admin/exchange — list all exchange offers (admin view, unfiltered by hidden/status)
  fastify.get<{
    Querystring: { status?: string; hidden?: string; currency?: string; limit?: number; offset?: number }
    Reply: { data: unknown[]; total: number; limit: number; offset: number } | ApiError
  }>('/', async (request) => {
    const { status, hidden, currency, limit = 20, offset = 0 } = request.query
    const safeLimit  = Math.min(Number(limit), MAX_PAGINATION_LIMIT)
    const safeOffset = Number(offset)

    const conditions: SQL[] = []
    if (status)   conditions.push(eq(exchange_offers.status, status as ExchangeOfferStatus))
    if (currency) conditions.push(eq(exchange_offers.fiat_currency, currency.toUpperCase()))
    if (String(hidden) === 'true')  conditions.push(eq(exchange_offers.hidden, true))
    if (String(hidden) === 'false') conditions.push(eq(exchange_offers.hidden, false))

    const where = conditions.length > 0 ? and(...conditions) : undefined

    const [data, countResult] = await Promise.all([
      fastify.db
        .select({
          id:              exchange_offers.id,
          lamports_amount: exchange_offers.lamports_amount,
          fiat_amount:     exchange_offers.fiat_amount,
          fiat_currency:   exchange_offers.fiat_currency,
          status:          exchange_offers.status,
          hidden:          exchange_offers.hidden,
          created_at:      exchange_offers.created_at,
          seller_id:       exchange_offers.seller_id,
          seller_first_name: users.first_name,
          seller_last_name:  users.last_name,
        })
        .from(exchange_offers)
        .innerJoin(users, eq(exchange_offers.seller_id, users.id))
        .where(where)
        .orderBy(desc(exchange_offers.created_at))
        .limit(safeLimit)
        .offset(safeOffset),
      fastify.db
        .select({ count: sql<number>`count(*)::int` })
        .from(exchange_offers)
        .where(where),
    ])

    return { data, total: countResult[0].count, limit: safeLimit, offset: safeOffset }
  })

  // GET /v1/admin/exchange/:id — full offer detail (admin sees all accounts and dispute info)
  fastify.get<{
    Params: { id: string }
    Reply: unknown | ApiError
  }>('/:id', async (request) => {
    const { id } = request.params

    const offer = await ensureOfferExists(fastify.db, id)

    const userIds = offer.buyer_id ? [offer.seller_id, offer.buyer_id] : [offer.seller_id]

    const [userRows, proofs, disputeRows, reviewRows, accounts] = await Promise.all([
      fastify.db
        .select()
        .from(users)
        .where(inArray(users.id, userIds)),
      fastify.db
        .select()
        .from(exchange_proofs)
        .where(eq(exchange_proofs.offer_id, id)),
      fastify.db
        .select()
        .from(exchange_disputes)
        .where(eq(exchange_disputes.offer_id, id))
        .limit(1),
      fastify.db
        .select()
        .from(reviews)
        .where(eq(reviews.offer_id, id)),
      offer.payment_account_ids.length > 0
        ? fastify.db
            .select()
            .from(user_exchange_accounts)
            .where(inArray(user_exchange_accounts.id, offer.payment_account_ids))
        : Promise.resolve([]),
    ])

    const userMap = new Map(userRows.map((u) => [u.id, u]))

    return {
      ...offer,
      seller:           userMap.get(offer.seller_id) ?? null,
      buyer:            offer.buyer_id ? (userMap.get(offer.buyer_id) ?? null) : null,
      payment_accounts: accounts, // admin always sees all accounts
      proofs,
      dispute:          disputeRows[0] ?? null,
      reviews:          reviewRows,
    }
  })

  // PATCH /v1/admin/exchange/:id/hide — role: support, moderator, super_admin
  fastify.patch<{
    Params: { id: string }
    Body:   { reason?: string }
    Reply:  { id: string; hidden: boolean } | ApiError
  }>('/:id/hide', { 
    preHandler: [requireRole(...MODERATION_ROLES)] 
  }, async (request) => {
    const { id } = request.params
    const { reason } = request.body ?? {}

    const [updated] = await fastify.db
      .update(exchange_offers)
      .set({ hidden: true, updated_at: new Date() })
      .where(eq(exchange_offers.id, id))
      .returning({ id: exchange_offers.id, hidden: exchange_offers.hidden })

    if (!updated) throw new AppError(404, ErrorCode.NOT_FOUND, 'Exchange offer not found')

    appEvents.emit('admin.hide_exchange', {
      adminId:     request.user.id,
      adminWallet: request.user.wallet_address,
      adminRole:   request.user.role,
      offerId:     id,
      reason,
    })

    return updated
  })

  // PATCH /v1/admin/exchange/:id/unhide — role: support, moderator, super_admin
  fastify.patch<{
    Params: { id: string }
    Reply:  { id: string; hidden: boolean } | ApiError
  }>('/:id/unhide', { 
    preHandler: [requireRole(...MODERATION_ROLES)] 
  }, async (request) => {
    const { id } = request.params

    const [updated] = await fastify.db
      .update(exchange_offers)
      .set({ hidden: false, updated_at: new Date() })
      .where(eq(exchange_offers.id, id))
      .returning({ id: exchange_offers.id, hidden: exchange_offers.hidden })

    if (!updated) throw new AppError(404, ErrorCode.NOT_FOUND, 'Exchange offer not found')

    appEvents.emit('admin.unhide_exchange', {
      adminId:     request.user.id,
      adminWallet: request.user.wallet_address,
      adminRole:   request.user.role,
      offerId:     id,
    })

    return updated
  })
}

export default adminExchange
