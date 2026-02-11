import { FastifyPluginAsync } from 'fastify'
import { eq } from 'drizzle-orm'
import { gigs } from '@tenda/shared/db/schema'
import type { GigsContract, ApiError } from '@tenda/shared'

type AcceptRoute = GigsContract['accept']

const acceptGig: FastifyPluginAsync = async (fastify) => {
  // POST /v1/gigs/:id/accept — worker accepts gig
  fastify.post<{
    Params: AcceptRoute['params']
    Reply: AcceptRoute['response'] | ApiError
  }>(
    '/',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const { id } = request.params

      const [gig] = await fastify.db.select().from(gigs).where(eq(gigs.id, id)).limit(1)

      if (!gig) {
        return reply.code(404).send({ statusCode: 404, error: 'Not Found', message: 'Gig not found' })
      }

      if (gig.status !== 'open') {
        return reply.code(400).send({ statusCode: 400, error: 'Bad Request', message: 'Gig is not open for acceptance' })
      }

      if (gig.poster_id === request.user.id) {
        return reply.code(400).send({ statusCode: 400, error: 'Bad Request', message: 'Cannot accept your own gig' })
      }

      const [updated] = await fastify.db
        .update(gigs)
        .set({
          worker_id: request.user.id,
          status: 'accepted',
          updated_at: new Date(),
        })
        .where(eq(gigs.id, id))
        .returning()

      return updated
    }
  )
}

export default acceptGig
