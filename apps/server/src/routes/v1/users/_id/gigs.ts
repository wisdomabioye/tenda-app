import { FastifyPluginAsync } from 'fastify'
import { eq, or, and, inArray, sql, SQL } from 'drizzle-orm'
import { gigs } from '@tenda/shared/db/schema'
import { MAX_PAGINATION_LIMIT } from '@tenda/shared'
import type { UsersContract, ApiError, GigStatus } from '@tenda/shared'

type UserGigsRoute = UsersContract['gigs']

// Statuses visible to anyone viewing another user's profile.
// Draft, cancelled, and disputed are considered private — only the owner sees them.
const PUBLIC_STATUSES: GigStatus[] = ['open', 'accepted', 'submitted', 'completed', 'resolved', 'expired']

const userGigs: FastifyPluginAsync = async (fastify) => {
  // GET /v1/users/:id/gigs — user's posted/worked gigs
  // Auth is optional: authenticated owner sees all statuses; others see public statuses only.
  fastify.get<{
    Params: UserGigsRoute['params']
    Querystring: UserGigsRoute['query']
    Reply: UserGigsRoute['response'] | ApiError
  }>('/', async (request) => {
    const { id } = request.params
    const { role, limit = 20, offset = 0 } = request.query

    const safeLimit  = Math.min(Number(limit),  MAX_PAGINATION_LIMIT)
    const safeOffset = Number(offset)

    // Optional auth — silently ignore an invalid or missing token
    let requesterId: string | undefined
    try {
      await request.jwtVerify()
      requesterId = request.user.id
    } catch {
      // Unauthenticated — public view only
    }

    const conditions: SQL[] = []

    if (role === 'poster') {
      conditions.push(eq(gigs.poster_id, id))
    } else if (role === 'worker') {
      conditions.push(eq(gigs.worker_id, id))
    } else {
      conditions.push(or(eq(gigs.poster_id, id), eq(gigs.worker_id, id))!)
    }

    // Non-owners only see public-facing statuses (not drafts, cancellations, or disputes)
    if (requesterId !== id) {
      conditions.push(inArray(gigs.status, PUBLIC_STATUSES))
    }

    const where = and(...conditions)

    const [data, countResult] = await Promise.all([
      fastify.db
        .select()
        .from(gigs)
        .where(where)
        .limit(safeLimit)
        .offset(safeOffset)
        .orderBy(sql`${gigs.created_at} DESC`),
      fastify.db
        .select({ count: sql<number>`count(*)::int` })
        .from(gigs)
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

export default userGigs
