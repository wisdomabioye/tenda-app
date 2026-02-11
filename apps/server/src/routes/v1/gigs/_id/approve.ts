import { FastifyPluginAsync } from 'fastify'
import { eq } from 'drizzle-orm'
import { gigs } from '@tenda/shared/db/schema'
import type { GigsContract, ApiError } from '@tenda/shared'

type ApproveRoute = GigsContract['approve']

const approveGig: FastifyPluginAsync = async (fastify) => {
  // POST /v1/gigs/:id/approve — poster approves + records tx
  fastify.post<{
    Params: ApproveRoute['params']
    Body: ApproveRoute['body']
    Reply: ApproveRoute['response'] | ApiError
  }>(
    '/',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const { id } = request.params
      const { transaction_signature } = request.body

      const [gig] = await fastify.db.select().from(gigs).where(eq(gigs.id, id)).limit(1)

      if (!gig) {
        return reply.code(404).send({ statusCode: 404, error: 'Not Found', message: 'Gig not found' })
      }

      if (gig.status !== 'submitted') {
        return reply.code(400).send({ statusCode: 400, error: 'Bad Request', message: 'Gig must be in submitted status to approve' })
      }

      if (gig.poster_id !== request.user.id) {
        return reply.code(403).send({ statusCode: 403, error: 'Forbidden', message: 'Only the poster can approve this gig' })
      }

      if (!transaction_signature) {
        return reply.code(400).send({ statusCode: 400, error: 'Bad Request', message: 'transaction_signature is required' })
      }

      const [updated] = await fastify.db
        .update(gigs)
        .set({
          status: 'completed',
          transaction_signature,
          updated_at: new Date(),
        })
        .where(eq(gigs.id, id))
        .returning()

      return updated
    }
  )
}

export default approveGig
