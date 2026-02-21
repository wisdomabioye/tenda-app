import { FastifyPluginAsync } from 'fastify'
import { eq } from 'drizzle-orm'
import { gigs, gig_transactions } from '@tenda/shared/db/schema'
import { ErrorCode } from '@tenda/shared'
import type { GigsContract, ApiError } from '@tenda/shared'

type TransactionsRoute = GigsContract['transactions']

const gigTransactionsRoute: FastifyPluginAsync = async (fastify) => {
  // GET /v1/gigs/:id/transactions — list all on-chain transactions for a gig
  fastify.get<{
    Params: TransactionsRoute['params']
    Reply: TransactionsRoute['response'] | ApiError
  }>('/', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { id } = request.params

    const [gig] = await fastify.db.select({ id: gigs.id }).from(gigs).where(eq(gigs.id, id)).limit(1)

    if (!gig) {
      return reply.code(404).send({
        statusCode: 404,
        error: 'Not Found',
        message: 'Gig not found',
        code: ErrorCode.GIG_NOT_FOUND,
      })
    }

    const txns = await fastify.db
      .select()
      .from(gig_transactions)
      .where(eq(gig_transactions.gig_id, id))
      .orderBy(gig_transactions.created_at)

    return txns
  })
}

export default gigTransactionsRoute
