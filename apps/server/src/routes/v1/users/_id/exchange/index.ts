import { FastifyPluginAsync } from 'fastify'
import { eq, or, desc, sql, inArray } from 'drizzle-orm'
import { exchange_offers, user_exchange_accounts, users } from '@tenda/shared/db/schema'
import { ErrorCode, MAX_PAGINATION_LIMIT } from '@tenda/shared'
import type { UsersContract, ApiError } from '@tenda/shared'
import { AppError } from '@server/lib/errors'
import { USER_COLS } from '@server/lib/users'

type UserExchangeOffersRoute = UsersContract['exchangeOffers']

const userExchangeOffers: FastifyPluginAsync = async (fastify) => {
  // GET /v1/users/:id/exchange — all offers where user is seller or buyer; auth required, own ID only
  fastify.get<{
    Params: UserExchangeOffersRoute['params']
    Querystring: UserExchangeOffersRoute['query']
    Reply: UserExchangeOffersRoute['response'] | ApiError
  }>('/', { preHandler: [fastify.authenticate] }, async (request) => {
    const { id } = request.params

    if (id !== request.user.id) {
      throw new AppError(403, ErrorCode.FORBIDDEN, 'You can only view your own exchange offers')
    }

    const { limit = 30, offset = 0 } = request.query

    const safeLimit  = Math.min(Number(limit),  MAX_PAGINATION_LIMIT)
    const safeOffset = Number(offset)

    const where = or(
      eq(exchange_offers.seller_id, id),
      eq(exchange_offers.buyer_id,  id),
    )!

    const [offersRows, countResult] = await Promise.all([
      fastify.db
        .select()
        .from(exchange_offers)
        .where(where)
        .limit(safeLimit)
        .offset(safeOffset)
        .orderBy(desc(exchange_offers.created_at)),
      fastify.db
        .select({ count: sql<number>`count(*)::int` })
        .from(exchange_offers)
        .where(where),
    ])

    if (offersRows.length === 0) {
      return { data: [], total: countResult[0].count, limit: safeLimit, offset: safeOffset }
    }

    const sellerIds     = [...new Set(offersRows.map((o) => o.seller_id))]
    const allAccountIds = [...new Set(offersRows.flatMap((o) => o.payment_account_ids))]

    const [sellerRows, accountRows] = await Promise.all([
      fastify.db
        .select(USER_COLS)
        .from(users)
        .where(inArray(users.id, sellerIds)),
      allAccountIds.length > 0
        ? fastify.db
            .select({ id: user_exchange_accounts.id, method: user_exchange_accounts.method })
            .from(user_exchange_accounts)
            .where(inArray(user_exchange_accounts.id, allAccountIds))
        : Promise.resolve([]),
    ])

    const sellerMap  = new Map(sellerRows.map((s) => [s.id, s]))
    const accountMap = new Map(accountRows.map((a) => [a.id, a.method]))

    const data = offersRows.map((offer) => ({
      id:                     offer.id,
      lamports_amount:        offer.lamports_amount,
      fiat_amount:            offer.fiat_amount,
      fiat_currency:          offer.fiat_currency,
      rate:                   offer.rate,
      status:                 offer.status,
      accept_deadline:        offer.accept_deadline,
      payment_window_seconds: offer.payment_window_seconds,
      created_at:             offer.created_at,
      seller:                 sellerMap.get(offer.seller_id)!,
      payment_methods: [...new Set(offer.payment_account_ids.map((aid) => accountMap.get(aid)).filter(Boolean))] as string[],
    }))

    return { data, total: countResult[0].count, limit: safeLimit, offset: safeOffset }
  })
}

export default userExchangeOffers
