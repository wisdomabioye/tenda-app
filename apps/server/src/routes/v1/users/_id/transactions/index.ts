import { FastifyPluginAsync } from 'fastify'
import { or, eq, sql } from 'drizzle-orm'
import { gigs, gig_transactions } from '@tenda/shared/db/schema'
import { ErrorCode, MAX_PAGINATION_LIMIT } from '@tenda/shared'
import type { UsersContract, ApiError } from '@tenda/shared'
import { AppError } from '@server/lib/errors'

type TransactionsRoute = UsersContract['transactions']

const userTransactions: FastifyPluginAsync = async (fastify) => {
  // GET /v1/users/:id/transactions — gig transactions where user is poster or worker.
  // Returns transactions enriched with minimal gig context for the wallet screen.
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

    const where = or(eq(gigs.poster_id, id), eq(gigs.worker_id, id))!

    const [rows, countResult] = await Promise.all([
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
        })
        .from(gig_transactions)
        .innerJoin(gigs, eq(gig_transactions.gig_id, gigs.id))
        .where(where)
        .orderBy(gig_transactions.created_at)
        .limit(safeLimit)
        .offset(safeOffset),
      fastify.db
        .select({ count: sql<number>`count(*)::int` })
        .from(gig_transactions)
        .innerJoin(gigs, eq(gig_transactions.gig_id, gigs.id))
        .where(where),
    ])

    const data = rows.map((row) => ({
      id:                    row.id,
      gig_id:                row.gig_id,
      type:                  row.type,
      signature:             row.signature,
      amount_lamports:       row.amount_lamports,
      platform_fee_lamports: row.platform_fee_lamports,
      created_at:            row.created_at ? row.created_at.toISOString() : null,
      gig: {
        id:               row.gig_id,
        title:            row.gig_title,
        status:           row.gig_status,
        payment_lamports: row.gig_payment_lamports,
        poster_id:        row.gig_poster_id,
        worker_id:        row.gig_worker_id,
      },
    }))

    return { data, total: countResult[0].count, limit: safeLimit, offset: safeOffset }
  })
}

export default userTransactions
