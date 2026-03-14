import { FastifyPluginAsync } from 'fastify'
import { eq } from 'drizzle-orm'
import { gig_transactions } from '@tenda/shared/db/schema'
import { ensureGigExists } from '@server/lib/gigs'
import type { GigsContract, ApiError } from '@tenda/shared'

type TransactionsRoute = GigsContract['transactions']

const gigTransactionsRoute: FastifyPluginAsync = async (fastify) => {
  // GET /v1/gigs/:id/transactions — list all on-chain transactions for a gig
  fastify.get<{
    Params: TransactionsRoute['params']
    Reply: TransactionsRoute['response'] | ApiError
  }>('/', { preHandler: [fastify.authenticate] }, async (request, _reply) => {
    const { id } = request.params

    await ensureGigExists(fastify.db, id)

    const txns = await fastify.db
      .select()
      .from(gig_transactions)
      .where(eq(gig_transactions.gig_id, id))
      .orderBy(gig_transactions.created_at)

    return txns
  })
}

export default gigTransactionsRoute
