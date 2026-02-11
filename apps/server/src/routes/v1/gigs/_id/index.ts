import { FastifyPluginAsync } from 'fastify'
import { eq } from 'drizzle-orm'
import { gigs, users } from '@tenda/shared/db/schema'
import type { GigsContract, ApiError } from '@tenda/shared'

type GetRoute = GigsContract['get']
type UpdateRoute = GigsContract['update']
type DeleteRoute = GigsContract['delete']

const gigById: FastifyPluginAsync = async (fastify) => {
  // GET /v1/gigs/:id — single gig with poster/worker details
  fastify.get<{
    Params: GetRoute['params']
    Reply: GetRoute['response'] | ApiError
  }>('/', async (request, reply) => {
    const { id } = request.params

    const [gig] = await fastify.db.select().from(gigs).where(eq(gigs.id, id)).limit(1)

    if (!gig) {
      return reply.code(404).send({ statusCode: 404, error: 'Not Found', message: 'Gig not found' })
    }

    const [poster] = await fastify.db
      .select({
        id: users.id,
        first_name: users.first_name,
        last_name: users.last_name,
        avatar_url: users.avatar_url,
        reputation_score: users.reputation_score,
      })
      .from(users)
      .where(eq(users.id, gig.poster_id))
      .limit(1)

    let worker = null
    if (gig.worker_id) {
      const [w] = await fastify.db
        .select({
          id: users.id,
          first_name: users.first_name,
          last_name: users.last_name,
          avatar_url: users.avatar_url,
          reputation_score: users.reputation_score,
        })
        .from(users)
        .where(eq(users.id, gig.worker_id))
        .limit(1)
      worker = w
    }

    return { ...gig, poster, worker }
  })

  // PUT /v1/gigs/:id — update (poster only, pre-acceptance)
  fastify.put<{
    Params: UpdateRoute['params']
    Body: UpdateRoute['body']
    Reply: UpdateRoute['response'] | ApiError
  }>('/', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { id } = request.params

    const [gig] = await fastify.db.select().from(gigs).where(eq(gigs.id, id)).limit(1)

    if (!gig) {
      return reply.code(404).send({ statusCode: 404, error: 'Not Found', message: 'Gig not found' })
    }

    if (gig.poster_id !== request.user.id) {
      return reply.code(403).send({ statusCode: 403, error: 'Forbidden', message: 'Only the poster can update this gig' })
    }

    if (gig.status !== 'draft') {
      return reply.code(400).send({ statusCode: 400, error: 'Bad Request', message: 'Can only update gigs that are draft' })
    }

    const updates: Record<string, unknown> = { updated_at: new Date() }
    const { title, description, payment, category, city, address, deadline } = request.body
    if (title !== undefined) updates.title = title
    if (description !== undefined) updates.description = description
    if (payment !== undefined) updates.payment = payment
    if (category !== undefined) updates.category = category
    if (city !== undefined) updates.city = city
    if (address !== undefined) updates.address = address
    if (deadline !== undefined) updates.deadline = new Date(deadline)

    const [updated] = await fastify.db.update(gigs).set(updates).where(eq(gigs.id, id)).returning()

    return updated
  })

  // DELETE /v1/gigs/:id — cancel (poster only, pre-acceptance)
  fastify.delete<{
    Params: DeleteRoute['params']
    Reply: DeleteRoute['response'] | ApiError
  }>(
    '/',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const { id } = request.params

      const [gig] = await fastify.db.select().from(gigs).where(eq(gigs.id, id)).limit(1)

      if (!gig) {
        return reply.code(404).send({ statusCode: 404, error: 'Not Found', message: 'Gig not found' })
      }

      if (gig.poster_id !== request.user.id) {
        return reply.code(403).send({ statusCode: 403, error: 'Forbidden', message: 'Only the poster can cancel this gig' })
      }

      if (gig.status !== 'open' && gig.status !== 'draft') {
        return reply.code(400).send({ statusCode: 400, error: 'Bad Request', message: 'Can only cancel gigs that are open or draft' })
      }

      const [cancelled] = await fastify.db
        .update(gigs)
        .set({ status: 'cancelled', updated_at: new Date() })
        .where(eq(gigs.id, id))
        .returning()

      return cancelled
    }
  )
}

export default gigById
