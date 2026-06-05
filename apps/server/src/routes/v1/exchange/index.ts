/**
 * Exchange order-book surface (cutover §3 rewrite): escrows kind='exchange'
 * ⨝ exchange_details ⨝ users. Read-only — creation and transitions live
 * under /v1/escrows. Auth required to keep the order book off public
 * scrapers; advanced-mode gating is a client concern (decision #14) — the
 * data itself carries no payment-account PII (bank details moved to
 * fiat-rails bank_accounts, revealed only inside an accepted intent).
 */
import { FastifyPluginAsync } from 'fastify'
import { eq, and, gt, gte, isNull, lte, or, desc, sql, type SQL } from 'drizzle-orm'
import { escrows, exchange_details, users } from '@tenda/shared/db/schema'
import { ErrorCode, MAX_PAGINATION_LIMIT } from '@tenda/shared'
import type { ExchangeContract, ApiError } from '@tenda/shared'
import { isAmountRaw } from '@server/chains/types'
import { AppError } from '@server/lib/errors'
import { EXCHANGE_SUMMARY_COLS, toExchangeSummary } from '@server/lib/exchange-read'

type ListRoute = ExchangeContract['list']

const exchangeRoutes: FastifyPluginAsync = async (fastify) => {
  // GET /v1/exchange — order book (auth required to prevent scraping)
  fastify.get<{
    Querystring: ListRoute['query']
    Reply: ListRoute['response'] | ApiError
  }>('/', { preHandler: [fastify.authenticate] }, async (request) => {
    const { currency, min_amount_raw, max_amount_raw, limit = 20, offset = 0 } = request.query

    const safeLimit = Math.min(Number(limit), MAX_PAGINATION_LIMIT)
    const safeOffset = Number(offset)

    const now = new Date()
    const conditions: SQL[] = [
      eq(escrows.kind, 'exchange'),
      // Market feed: open offers whose accept window hasn't passed —
      // display-correct even between expire-escrows job ticks. Taken-down
      // offers (CO1) never surface here.
      eq(escrows.status, 'open'),
      eq(escrows.hidden, false),
      or(isNull(escrows.accept_deadline), gt(escrows.accept_deadline, now)) as SQL,
    ]

    if (currency) conditions.push(eq(exchange_details.fiat_currency, currency.toUpperCase()))

    if (min_amount_raw !== undefined && !isAmountRaw(min_amount_raw)) {
      throw new AppError(400, ErrorCode.VALIDATION_ERROR, 'min_amount_raw must be a decimal integer string')
    }
    if (max_amount_raw !== undefined && !isAmountRaw(max_amount_raw)) {
      throw new AppError(400, ErrorCode.VALIDATION_ERROR, 'max_amount_raw must be a decimal integer string')
    }
    if (
      min_amount_raw !== undefined &&
      max_amount_raw !== undefined &&
      BigInt(min_amount_raw) > BigInt(max_amount_raw)
    ) {
      throw new AppError(400, ErrorCode.VALIDATION_ERROR, 'min_amount_raw must be ≤ max_amount_raw')
    }
    if (min_amount_raw !== undefined) conditions.push(gte(escrows.amount_raw, min_amount_raw))
    if (max_amount_raw !== undefined) conditions.push(lte(escrows.amount_raw, max_amount_raw))

    const where = and(...conditions)

    const [data, countResult] = await Promise.all([
      fastify.db
        .select(EXCHANGE_SUMMARY_COLS)
        .from(escrows)
        .innerJoin(exchange_details, eq(exchange_details.escrow_id, escrows.id))
        .innerJoin(users, eq(users.id, escrows.creator_id))
        .where(where)
        .limit(safeLimit)
        .offset(safeOffset)
        .orderBy(desc(escrows.created_at)),
      fastify.db
        .select({ count: sql<number>`count(*)::int` })
        .from(escrows)
        .innerJoin(exchange_details, eq(exchange_details.escrow_id, escrows.id))
        .where(where),
    ])

    return {
      data: data.map(toExchangeSummary),
      total: countResult[0].count,
      limit: safeLimit,
      offset: safeOffset,
    }
  })
}

export default exchangeRoutes
