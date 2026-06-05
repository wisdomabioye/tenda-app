/**
 * Exchange order-book surface (cutover §3 rewrite): escrows kind='exchange'
 * ⨝ exchange_details ⨝ users.
 *   GET  / — the order book (auth required to keep it off public scrapers;
 *            advanced-mode gating is a client concern, decision #14).
 *   POST / — attach exchange_details to the caller's DRAFT escrow (CO4
 *            advanced-mode offer creation — mirror of the gig create-detail
 *            step). Transitions live under /v1/escrows. The data carries no
 *            payment-account PII (bank details live in fiat-rails
 *            bank_accounts, revealed only inside an accepted intent).
 */
import { FastifyPluginAsync } from 'fastify'
import { eq, and, gt, gte, isNull, lte, or, desc, sql, type SQL } from 'drizzle-orm'
import { escrows, exchange_details, users } from '@tenda/shared/db/schema'
import {
  ErrorCode,
  MAX_PAGINATION_LIMIT,
  SUPPORTED_CURRENCIES,
  EXCHANGE_PAYMENT_WINDOW_MIN_SECONDS,
  EXCHANGE_PAYMENT_WINDOW_DEFAULT_SECONDS,
  EXCHANGE_PAYMENT_WINDOW_MAX_SECONDS,
} from '@tenda/shared'
import type { ExchangeContract, ApiError, SupportedCurrency } from '@tenda/shared'
import { isAmountRaw } from '@server/chains/types'
import { AppError } from '@server/lib/errors'
import { loadEscrowOr404 } from '@server/lib/escrow-routes'
import { EXCHANGE_SUMMARY_COLS, toExchangeSummary } from '@server/lib/exchange-read'

type ListRoute = ExchangeContract['list']
type CreateRoute = ExchangeContract['create']

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

  // POST /v1/exchange — attach the offer terms to the caller's draft
  // escrow (CO4). Upsert while draft so a retry after a validation fix
  // never 409s; once the create tx confirms (draft → open) the satellite
  // is immutable through this route. Numbers only — no moderation gate.
  fastify.post<{
    Body: CreateRoute['body']
    Reply: CreateRoute['response'] | ApiError
  }>('/', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const body = request.body ?? {}
    if (typeof body.escrow_id !== 'string' || body.escrow_id === '') {
      throw new AppError(400, ErrorCode.VALIDATION_ERROR, 'escrow_id is required')
    }

    const fiat_amount = body.fiat_amount
    if (typeof fiat_amount !== 'number' || !Number.isFinite(fiat_amount) || fiat_amount <= 0) {
      throw new AppError(400, ErrorCode.VALIDATION_ERROR, 'fiat_amount must be a positive number')
    }
    const rate = body.rate
    if (typeof rate !== 'number' || !Number.isFinite(rate) || rate <= 0) {
      throw new AppError(400, ErrorCode.VALIDATION_ERROR, 'rate must be a positive number')
    }
    const fiat_currency = String(body.fiat_currency ?? '').toUpperCase()
    if (!SUPPORTED_CURRENCIES.includes(fiat_currency as SupportedCurrency)) {
      throw new AppError(
        400,
        ErrorCode.VALIDATION_ERROR,
        `fiat_currency must be one of: ${SUPPORTED_CURRENCIES.join(', ')}`,
      )
    }
    const payment_window_seconds = body.payment_window_seconds ?? EXCHANGE_PAYMENT_WINDOW_DEFAULT_SECONDS
    if (
      !Number.isInteger(payment_window_seconds) ||
      payment_window_seconds < EXCHANGE_PAYMENT_WINDOW_MIN_SECONDS ||
      payment_window_seconds > EXCHANGE_PAYMENT_WINDOW_MAX_SECONDS
    ) {
      throw new AppError(
        400,
        ErrorCode.VALIDATION_ERROR,
        `payment_window_seconds must be an integer between ${EXCHANGE_PAYMENT_WINDOW_MIN_SECONDS} and ${EXCHANGE_PAYMENT_WINDOW_MAX_SECONDS}`,
      )
    }

    const escrow = await loadEscrowOr404(fastify.db, body.escrow_id)
    if (escrow.creator_id !== request.user.id) {
      throw new AppError(403, ErrorCode.FORBIDDEN, 'Only the escrow creator can attach offer terms')
    }
    if (escrow.kind !== 'exchange') {
      throw new AppError(409, ErrorCode.ESCROW_WRONG_STATUS, 'Offer terms can only be attached to exchange escrows')
    }
    if (escrow.status !== 'draft') {
      throw new AppError(409, ErrorCode.ESCROW_WRONG_STATUS, 'Offer terms can only be attached while the escrow is a draft')
    }

    const values = {
      escrow_id: escrow.id,
      fiat_amount: fiat_amount.toFixed(4),
      fiat_currency,
      rate: rate.toFixed(10),
      payment_window_seconds,
    }
    const [row] = await fastify.db
      .insert(exchange_details)
      .values(values)
      .onConflictDoUpdate({ target: exchange_details.escrow_id, set: values })
      .returning()

    return reply.code(201).send(row)
  })
}

export default exchangeRoutes
