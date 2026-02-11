import { FastifyPluginAsync } from 'fastify'
import { eq, or, sql } from 'drizzle-orm'
import { gigs } from '@tenda/shared/db/schema'
import type { UsersContract, ApiError } from '@tenda/shared'

type UserGigsRoute = UsersContract['gigs']

const userGigs: FastifyPluginAsync = async (fastify) => {
  // GET /v1/users/:id/gigs — user's posted/worked gigs
  fastify.get<{
    Params: UserGigsRoute['params']
    Querystring: UserGigsRoute['query']
    Reply: UserGigsRoute['response'] | ApiError
  }>('/', async (request) => {
    const { id } = request.params
    const { role, limit = 20, offset = 0 } = request.query

    let where
    if (role === 'poster') {
      where = eq(gigs.poster_id, id)
    } else if (role === 'worker') {
      where = eq(gigs.worker_id, id)
    } else {
      where = or(eq(gigs.poster_id, id), eq(gigs.worker_id, id))
    }

    const [data, countResult] = await Promise.all([
      fastify.db
        .select()
        .from(gigs)
        .where(where)
        .limit(Number(limit))
        .offset(Number(offset))
        .orderBy(sql`${gigs.created_at} DESC`),
      fastify.db
        .select({ count: sql<number>`count(*)::int` })
        .from(gigs)
        .where(where),
    ])

    return {
      data,
      total: countResult[0].count,
      limit: Number(limit),
      offset: Number(offset),
    }
  })
}

export default userGigs
