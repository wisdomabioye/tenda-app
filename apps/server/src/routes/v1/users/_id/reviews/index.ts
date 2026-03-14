import { FastifyPluginAsync } from 'fastify'
import { eq, sql } from 'drizzle-orm'
import { reviews } from '@tenda/shared/db/schema'
import { MAX_PAGINATION_LIMIT } from '@tenda/shared'
import { ensureUserExists } from '@server/lib/users'
import type { UsersContract, ApiError } from '@tenda/shared'

type ReviewsRoute = UsersContract['reviews']

const userReviews: FastifyPluginAsync = async (fastify) => {
  // GET /v1/users/:id/reviews — paginated list of reviews for a user
  fastify.get<{
    Params: ReviewsRoute['params']
    Querystring: ReviewsRoute['query']
    Reply: ReviewsRoute['response'] | ApiError
  }>('/', async (request, _reply) => {
    const { id } = request.params
    const { limit = 20, offset = 0 } = request.query

    const safeLimit  = Math.min(Number(limit),  MAX_PAGINATION_LIMIT)
    const safeOffset = Number(offset)

    await ensureUserExists(fastify.db, id)

    const where = eq(reviews.reviewee_id, id)

    const [data, countResult] = await Promise.all([
      fastify.db
        .select()
        .from(reviews)
        .where(where)
        .limit(safeLimit)
        .offset(safeOffset)
        .orderBy(reviews.created_at),
      fastify.db
        .select({ count: sql<number>`count(*)::int` })
        .from(reviews)
        .where(where),
    ])

    return {
      data,
      total:  countResult[0].count,
      limit:  safeLimit,
      offset: safeOffset,
    }
  })
}

export default userReviews
