import { FastifyPluginAsync } from 'fastify'
import { eq, and, gte, lte, desc, sql, inArray } from 'drizzle-orm'
import { exchange_offers, user_exchange_accounts, users } from '@tenda/shared/db/schema'
import { ErrorCode, MAX_PAGINATION_LIMIT } from '@tenda/shared'
import type { ExchangeContract, ApiError } from '@tenda/shared'
import { AppError } from '@server/lib/errors'
import { batchExpireOffers } from '@server/lib/exchange'
import { USER_COLS } from '@server/lib/users'

type ListRoute   = ExchangeContract['list']
type CreateRoute = ExchangeContract['create']

const exchangeRoutes: FastifyPluginAsync = async (fastify) => {

  // GET /v1/exchange — list offers (auth required to prevent PII scraping)
  fastify.get<{
    Querystring: ListRoute['query']
    Reply: ListRoute['response'] | ApiError
  }>('/', { preHandler: [fastify.authenticate] }, async (request) => {
    await batchExpireOffers(fastify.db, fastify.log)

    const {
      currency,
      min_lamports,
      max_lamports,
      limit  = 20,
      offset = 0,
    } = request.query

    const safeLimit  = Math.min(Number(limit),  MAX_PAGINATION_LIMIT)
    const safeOffset = Number(offset)

    const conditions = []

    // Market feed: only open offers
    conditions.push(eq(exchange_offers.status, 'open'))
    if (currency) conditions.push(eq(exchange_offers.fiat_currency, currency.toUpperCase()))
    if (min_lamports !== undefined) {
      const n = Number(min_lamports)
      if (Number.isFinite(n) && n >= 0) conditions.push(gte(exchange_offers.lamports_amount, n))
    }
    if (max_lamports !== undefined) {
      const n = Number(max_lamports)
      if (Number.isFinite(n) && n >= 0) conditions.push(lte(exchange_offers.lamports_amount, n))
    }
    if (min_lamports !== undefined && max_lamports !== undefined) {
      const mn = Number(min_lamports)
      const mx = Number(max_lamports)
      if (Number.isFinite(mn) && Number.isFinite(mx) && mn > mx) {
        throw new AppError(400, ErrorCode.VALIDATION_ERROR, 'min_lamports must be less than or equal to max_lamports')
      }
    }

    const where = and(...conditions)

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

    const sellerIds    = [...new Set(offersRows.map((o) => o.seller_id))]
    // Collect all referenced account IDs across all offers
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
      payment_methods:        [...new Set(offer.payment_account_ids.map((id) => accountMap.get(id)).filter(Boolean))] as string[],
    }))

    return { data, total: countResult[0].count, limit: safeLimit, offset: safeOffset }
  })

  // POST /v1/exchange — create exchange offer (seller must have active accounts)
  fastify.post<{
    Body: CreateRoute['body']
    Reply: CreateRoute['response'] | ApiError
  }>(
    '/',
    {
      preHandler: [fastify.authenticate],
      config: { rateLimit: { max: 5, timeWindow: '1 minute' } },
    },
    async (request, reply) => {
      const {
        lamports_amount,
        fiat_amount,
        fiat_currency,
        payment_window_seconds = 86400,
        accept_deadline,
        account_ids,
      } = request.body

      if (!lamports_amount || !fiat_amount || !fiat_currency || !account_ids?.length) {
        throw new AppError(400, ErrorCode.VALIDATION_ERROR, 'lamports_amount, fiat_amount, fiat_currency, and account_ids are required')
      }

      const lamportsNum = Number(lamports_amount)
      if (!Number.isFinite(lamportsNum) || lamportsNum <= 0) {
        throw new AppError(400, ErrorCode.VALIDATION_ERROR, 'lamports_amount must be positive')
      }

      if (fiat_amount <= 0) {
        throw new AppError(400, ErrorCode.VALIDATION_ERROR, 'fiat_amount must be positive')
      }
      if (!Number.isInteger(fiat_amount)) {
        throw new AppError(400, ErrorCode.VALIDATION_ERROR, 'fiat_amount must be a whole number (no decimals)')
      }

      const currencyUpper = fiat_currency.toUpperCase()
      if (!/^[A-Z]{3}$/.test(currencyUpper)) {
        throw new AppError(400, ErrorCode.VALIDATION_ERROR, 'fiat_currency must be a 3-letter ISO 4217 currency code')
      }

      // payment_window_seconds: 60s (1 min) to 604800s (7 days)
      const windowSecs = Number(payment_window_seconds)
      if (!Number.isInteger(windowSecs) || windowSecs < 60 || windowSecs > 604800) {
        throw new AppError(400, ErrorCode.VALIDATION_ERROR, 'payment_window_seconds must be between 60 and 604800')
      }

      // Validate account_ids belong to this seller and are active
      const ownedAccounts = await fastify.db
        .select()
        .from(user_exchange_accounts)
        .where(
          and(
            inArray(user_exchange_accounts.id, account_ids),
            eq(user_exchange_accounts.user_id, request.user.id),
            eq(user_exchange_accounts.is_active, true),
          )
        )

      if (ownedAccounts.length !== account_ids.length) {
        throw new AppError(400, ErrorCode.VALIDATION_ERROR, 'One or more account_ids are invalid or do not belong to you')
      }

      let acceptDeadlineDate: Date | null = null
      if (accept_deadline) {
        acceptDeadlineDate = new Date(accept_deadline)
        if (isNaN(acceptDeadlineDate.getTime()) || acceptDeadlineDate <= new Date()) {
          throw new AppError(400, ErrorCode.VALIDATION_ERROR, 'accept_deadline must be a valid future ISO 8601 date')
        }
      }

      const [offer] = await fastify.db
        .insert(exchange_offers)
        .values({
          seller_id:              request.user.id,
          lamports_amount:        lamportsNum,
          fiat_amount:            fiat_amount,
          fiat_currency:          currencyUpper,
          rate:                   Math.round(fiat_amount / (lamportsNum / 1_000_000_000)),
          payment_window_seconds: windowSecs,
          payment_account_ids:    account_ids,
          accept_deadline:        acceptDeadlineDate,
          status:                 'draft',
        })
        .returning()

      const [sellerRow] = await fastify.db
        .select(USER_COLS)
        .from(users)
        .where(eq(users.id, request.user.id))
        .limit(1)

      return reply.code(201).send({
        ...offer,
        seller:           sellerRow,
        buyer:            null,
        payment_accounts: ownedAccounts,
        proofs:           [],
        dispute:          null,
        reviews:          [],
      })
    }
  )
}

export default exchangeRoutes
