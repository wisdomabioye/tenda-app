import { FastifyPluginAsync } from 'fastify'
import { eq } from 'drizzle-orm'
import { users } from '@tenda/shared/db/schema'
import type { UsersContract, ApiError } from '@tenda/shared'

type GetRoute = UsersContract['get']
type UpdateRoute = UsersContract['update']

const userById: FastifyPluginAsync = async (fastify) => {
  // GET /v1/users/:id — public profile (no wallet_address)
  fastify.get<{
    Params: GetRoute['params']
    Reply: GetRoute['response'] | ApiError
  }>('/', async (request, reply) => {
    const { id } = request.params

    const [user] = await fastify.db
      .select({
        id: users.id,
        first_name: users.first_name,
        last_name: users.last_name,
        avatar_url: users.avatar_url,
        city: users.city,
        reputation_score: users.reputation_score,
        created_at: users.created_at,
      })
      .from(users)
      .where(eq(users.id, id))
      .limit(1)

    if (!user) {
      return reply.code(404).send({ statusCode: 404, error: 'Not Found', message: 'User not found' })
    }

    return user
  })

  // PUT /v1/users/:id — update own profile
  fastify.put<{
    Params: UpdateRoute['params']
    Body: UpdateRoute['body']
    Reply: UpdateRoute['response'] | ApiError
  }>('/', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { id } = request.params

    if (id !== request.user.id) {
      return reply.code(403).send({ statusCode: 403, error: 'Forbidden', message: 'Can only update your own profile' })
    }

    const updates: Record<string, unknown> = { updated_at: new Date() }
    const { first_name, last_name, avatar_url, city } = request.body
    if (first_name !== undefined) updates.first_name = first_name
    if (last_name !== undefined) updates.last_name = last_name
    if (avatar_url !== undefined) updates.avatar_url = avatar_url
    if (city !== undefined) updates.city = city

    const [updated] = await fastify.db.update(users).set(updates).where(eq(users.id, id)).returning()

    return updated
  })
}

export default userById
