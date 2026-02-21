import { FastifyPluginAsync } from 'fastify'
import { eq } from 'drizzle-orm'
import { gigs, gig_proofs } from '@tenda/shared/db/schema'
import type { GigsContract, ApiError } from '@tenda/shared'

type SubmitRoute = GigsContract['submit']

const submitGig: FastifyPluginAsync = async (fastify) => {
  // POST /v1/gigs/:id/submit — worker submits proof URLs
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

      await fastify.db
        .update(gigs)
        .set({ status: 'submitted', updated_at: new Date() })
        .where(eq(gigs.id, id))

      const proofs = await fastify.db
        .insert(gig_proofs)
        .values(proof_urls.map(url => ({ gig_id: id, uploaded_by_id: request.user.id, url })))
        .returning()

      return reply.code(201).send(proofs)
    }
  )
}

export default submitGig
