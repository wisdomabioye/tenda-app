import { FastifyPluginAsync } from 'fastify'
import { desc, sql, and, gte, lte } from 'drizzle-orm'
import { gig_transactions, exchange_transactions } from '@tenda/shared/db/schema'
import { ErrorCode, MAX_PAGINATION_LIMIT } from '@tenda/shared'
import { requireRole } from '@server/lib/guards'
import { AppError } from '@server/lib/errors'
import type { ApiError } from '@tenda/shared'

const FINANCE_ROLES = ['finance', 'super_admin'] as const

const adminFinance: FastifyPluginAsync = async (fastify) => {
  // GET /v1/admin/finance/fees — aggregate platform fee income
  // Optional filters: from (ISO date), to (ISO date)
  fastify.get<{
    Querystring: { from?: string; to?: string }
    Reply: unknown | ApiError
  }>('/fees', {
    preHandler: [requireRole(...FINANCE_ROLES)],
  }, async (request) => {
    const { from, to } = request.query

    const fromDate = from ? new Date(from) : null
    const toDate   = to   ? new Date(to)   : null

    if (fromDate && isNaN(fromDate.getTime())) {
      throw new AppError(400, ErrorCode.VALIDATION_ERROR, 'from must be a valid ISO date')
    }
    if (toDate && isNaN(toDate.getTime())) {
      throw new AppError(400, ErrorCode.VALIDATION_ERROR, 'to must be a valid ISO date')
    }

    const gigConditions = [
      ...(fromDate ? [gte(gig_transactions.created_at, fromDate)] : []),
      ...(toDate   ? [lte(gig_transactions.created_at, toDate)]   : []),
    ]
    const exchangeConditions = [
      ...(fromDate ? [gte(exchange_transactions.created_at, fromDate)] : []),
      ...(toDate   ? [lte(exchange_transactions.created_at, toDate)]   : []),
    ]

    const [gigFees, exchangeFees] = await Promise.all([
      fastify.db
        .select({
          type:                    gig_transactions.type,
          transaction_count:       sql<number>`count(*)::int`,
          total_platform_fee:      sql<string>`sum(platform_fee_lamports)::text`,  // text to avoid JS number overflow on large sums
          total_amount:            sql<string>`sum(amount_lamports)::text`,
        })
        .from(gig_transactions)
        .where(gigConditions.length > 0 ? and(...gigConditions) : undefined)
        .groupBy(gig_transactions.type),

      fastify.db
        .select({
          type:                    exchange_transactions.type,
          transaction_count:       sql<number>`count(*)::int`,
          total_platform_fee:      sql<string>`sum(platform_fee_lamports)::text`,
          total_amount:            sql<string>`sum(amount_lamports)::text`,
        })
        .from(exchange_transactions)
        .where(exchangeConditions.length > 0 ? and(...exchangeConditions) : undefined)
        .groupBy(exchange_transactions.type),
    ])

    // Grand totals
    const totalGigFee      = gigFees.reduce((acc, r) => acc + BigInt(r.total_platform_fee ?? '0'), 0n)
    const totalExchangeFee = exchangeFees.reduce((acc, r) => acc + BigInt(r.total_platform_fee ?? '0'), 0n)

    return {
      period: { from: fromDate ?? null, to: toDate ?? null },
      gig: {
        by_type:      gigFees,
        total_fee_lamports: totalGigFee.toString(),
      },
      exchange: {
        by_type:      exchangeFees,
        total_fee_lamports: totalExchangeFee.toString(),
      },
      grand_total_fee_lamports: (totalGigFee + totalExchangeFee).toString(),
    }
  })

  // GET /v1/admin/finance/transactions — paginated ledger across both tables
  // type: 'gig' | 'exchange' (required — can't paginate a UNION efficiently at scale)
  fastify.get<{
    Querystring: {
      type: string
      from?: string; to?: string
      tx_type?: string
      limit?: number; offset?: number
    }
    Reply: { data: unknown[]; total: number; limit: number; offset: number } | ApiError
  }>('/transactions', {
    preHandler: [requireRole(...FINANCE_ROLES)],
  }, async (request) => {
    const { type, from, to, tx_type, limit = 20, offset = 0 } = request.query
    const safeLimit  = Math.min(Number(limit), MAX_PAGINATION_LIMIT)
    const safeOffset = Number(offset)

    if (type !== 'gig' && type !== 'exchange') {
      throw new AppError(400, ErrorCode.VALIDATION_ERROR, 'type must be "gig" or "exchange"')
    }

    const fromDate = from ? new Date(from) : null
    const toDate   = to   ? new Date(to)   : null

    if (fromDate && isNaN(fromDate.getTime())) {
      throw new AppError(400, ErrorCode.VALIDATION_ERROR, 'from must be a valid ISO date')
    }
    if (toDate && isNaN(toDate.getTime())) {
      throw new AppError(400, ErrorCode.VALIDATION_ERROR, 'to must be a valid ISO date')
    }

    if (type === 'gig') {
      const conditions = [
        ...(fromDate ? [gte(gig_transactions.created_at, fromDate)] : []),
        ...(toDate   ? [lte(gig_transactions.created_at, toDate)]   : []),
        ...(tx_type  ? [sql`${gig_transactions.type} = ${tx_type}`] : []),
      ]
      const where = conditions.length > 0 ? and(...conditions) : undefined

      const [data, countResult] = await Promise.all([
        fastify.db.select().from(gig_transactions).where(where)
          .orderBy(desc(gig_transactions.created_at)).limit(safeLimit).offset(safeOffset),
        fastify.db.select({ count: sql<number>`count(*)::int` }).from(gig_transactions).where(where),
      ])
      return { data, total: countResult[0].count, limit: safeLimit, offset: safeOffset }
    }

    // exchange
    const conditions = [
      ...(fromDate ? [gte(exchange_transactions.created_at, fromDate)] : []),
      ...(toDate   ? [lte(exchange_transactions.created_at, toDate)]   : []),
      ...(tx_type  ? [sql`${exchange_transactions.type} = ${tx_type}`] : []),
    ]
    const where = conditions.length > 0 ? and(...conditions) : undefined

    const [data, countResult] = await Promise.all([
      fastify.db.select().from(exchange_transactions).where(where)
        .orderBy(desc(exchange_transactions.created_at)).limit(safeLimit).offset(safeOffset),
      fastify.db.select({ count: sql<number>`count(*)::int` }).from(exchange_transactions).where(where),
    ])
    return { data, total: countResult[0].count, limit: safeLimit, offset: safeOffset }
  })
}

export default adminFinance
