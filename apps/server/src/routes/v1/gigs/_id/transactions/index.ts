import { FastifyPluginAsync } from 'fastify'
import { eq } from 'drizzle-orm'
import { gig_transactions } from '@tenda/shared/db/schema'
import { ensureGigExists } from '@server/lib/gigs'
import { ErrorCode } from '@tenda/shared'
import type { GigsContract, ApiError } from '@tenda/shared'
import { AppError } from '@server/lib/errors'

type TransactionsRoute = GigsContract['transactions']

const gigTransactionsRoute: FastifyPluginAsync = async (fastify) => {
  // GET /v1/gigs/:id/transactions — list all on-chain transactions for a gig
  // Restricted to the poster and worker — contains fees, amounts, and signatures.
  fastify.get<{
    Params: TransactionsRoute['params']
    Reply: TransactionsRoute['response'] | ApiError
  }>('/', { preHandler: [fastify.authenticate] }, async (request, _reply) => {
    const { id } = request.params
    const userId = request.user.id

    const gig = await ensureGigExists(fastify.db, id)

    if (gig.poster_id !== userId && gig.worker_id !== userId) {
      throw new AppError(403, ErrorCode.FORBIDDEN, 'Only the poster or worker can view transactions for this gig')
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
