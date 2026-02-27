import { FastifyPluginAsync } from 'fastify'
import { or, eq } from 'drizzle-orm'
import { gigs, gig_transactions } from '@tenda/shared/db/schema'
import { ErrorCode } from '@tenda/shared'
import type { UsersContract, ApiError } from '@tenda/shared'

type TransactionsRoute = UsersContract['transactions']

const userTransactions: FastifyPluginAsync = async (fastify) => {
  // GET /v1/users/:id/transactions — all gig transactions where user is poster or worker.
  // Returns transactions enriched with minimal gig context for the wallet screen.
  fastify.get<{
    Params: TransactionsRoute['params']
    Reply: TransactionsRoute['response'] | ApiError
  }>('/', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { id } = request.params

    // Only allow users to fetch their own transactions
    if (id !== request.user.id) {
      return reply.code(403).send({
        statusCode: 403,
        error: 'Forbidden',
        message: 'Can only fetch your own transactions',
        code: ErrorCode.FORBIDDEN,
      })
    }

    // Single JOIN query: transactions for all gigs where user is poster or worker
    const rows = await fastify.db
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
      .where(or(eq(gigs.poster_id, id), eq(gigs.worker_id, id)))
      .orderBy(gig_transactions.created_at)

    return rows.map((row) => ({
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
  })
}

export default userTransactions
