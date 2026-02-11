import { FastifyPluginAsync } from 'fastify'
import { eq } from 'drizzle-orm'
import { gigs } from '@tenda/shared/db/schema'
import type { GigsContract, ApiError } from '@tenda/shared'

type SubmitRoute = GigsContract['submit']

const submitGig: FastifyPluginAsync = async (fastify) => {
  // POST /v1/gigs/:id/submit — worker submits proof
  fastify.post<{
    Params: SubmitRoute['params']
    Body: SubmitRoute['body']
    Reply: SubmitRoute['response'] | ApiError
  }>(
    '/',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const { id } = request.params
      const { proof_urls } = request.body

      const [gig] = await fastify.db.select().from(gigs).where(eq(gigs.id, id)).limit(1)

      if (!gig) {
        return reply.code(404).send({ statusCode: 404, error: 'Not Found', message: 'Gig not found' })
      }

      if (gig.status !== 'accepted') {
        return reply.code(400).send({ statusCode: 400, error: 'Bad Request', message: 'Gig must be in accepted status to submit proof' })
      }

      if (gig.worker_id !== request.user.id) {
        return reply.code(403).send({ statusCode: 403, error: 'Forbidden', message: 'Only the assigned worker can submit proof' })
      }

      if (!proof_urls || !Array.isArray(proof_urls) || proof_urls.length === 0) {
        return reply.code(400).send({ statusCode: 400, error: 'Bad Request', message: 'At least one proof URL is required' })
      }

      const [updated] = await fastify.db
        .update(gigs)
        .set({
          status: 'submitted',
          proof_urls,
          updated_at: new Date(),
        })
        .where(eq(gigs.id, id))
        .returning()

      return updated
    }
  )
}

export default submitGig
