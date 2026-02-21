import { FastifyPluginAsync } from 'fastify'
import { eq } from 'drizzle-orm'
import { gigs, disputes } from '@tenda/shared/db/schema'
import { MAX_DISPUTE_REASON_LENGTH } from '@tenda/shared'
import type { GigsContract, ApiError } from '@tenda/shared'

type DisputeRoute = GigsContract['dispute']

const disputeGig: FastifyPluginAsync = async (fastify) => {
  // POST /v1/gigs/:id/dispute — open dispute
  fastify.post<{
    Params: DisputeRoute['params']
    Body: DisputeRoute['body']
    Reply: DisputeRoute['response'] | ApiError
  }>(
    '/',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const { id } = request.params

      const [gig] = await fastify.db.select().from(gigs).where(eq(gigs.id, id)).limit(1)

      if (!gig) {
        return reply.code(404).send({ statusCode: 404, error: 'Not Found', message: 'Gig not found' })
      }

      if (gig.status !== 'submitted' && gig.status !== 'accepted') {
        return reply.code(400).send({ statusCode: 400, error: 'Bad Request', message: 'Can only dispute gigs that are accepted or submitted' })
      }

      const { reason } = request.body
      if (!reason || reason.trim().length === 0) {
        return reply.code(400).send({ statusCode: 400, error: 'Bad Request', message: 'reason is required' })
      }

      if (reason.trim().length > MAX_DISPUTE_REASON_LENGTH) {
        return reply.code(400).send({ statusCode: 400, error: 'Bad Request', message: `Reason must be at most ${MAX_DISPUTE_REASON_LENGTH} characters` })
      }

      const userId = request.user.id
      if (gig.poster_id !== userId && gig.worker_id !== userId) {
        return reply.code(403).send({ statusCode: 403, error: 'Forbidden', message: 'Only the poster or worker can dispute this gig' })
      }

      const [updated] = await fastify.db
        .update(gigs)
        .set({ status: 'disputed', updated_at: new Date() })
        .where(eq(gigs.id, id))
        .returning()

      await fastify.db.insert(disputes).values({
        gig_id: id,
        raised_by_id: userId,
        reason: reason.trim(),
      })

      return updated
    }
  )
}

export default disputeGig
