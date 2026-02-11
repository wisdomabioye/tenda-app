import { FastifyPluginAsync } from 'fastify'
import { eq, and, sql, SQL } from 'drizzle-orm'
import { gigs } from '@tenda/shared/db/schema'
import { isValidPayment, MAX_GIG_TITLE_LENGTH, MAX_GIG_DESCRIPTION_LENGTH } from '@tenda/shared'
import type { GigsContract, ApiError, GigStatus } from '@tenda/shared'

type ListRoute = GigsContract['list']
type CreateRoute = GigsContract['create']

const gigsRoutes: FastifyPluginAsync = async (fastify) => {
  // GET /v1/gigs — list with filters
  fastify.get<{
    Querystring: ListRoute['query']
    Reply: ListRoute['response']
  }>('/', async (request) => {
    const { status, city, category, limit = 20, offset = 0 } = request.query

    const conditions: SQL[] = []
    if (status) conditions.push(eq(gigs.status, status as GigStatus))
    if (city) conditions.push(eq(gigs.city, city))
    if (category) conditions.push(eq(gigs.category, category))

    const where = conditions.length > 0 ? and(...conditions) : undefined

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

  // POST /v1/gigs — create gig
  fastify.post<{
    Body: CreateRoute['body']
    Reply: CreateRoute['response'] | ApiError
  }>(
    '/',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const { title, description, payment, category, city, address, deadline } = request.body

      if (!title || !description || !payment || !category || !city || !deadline) {
        return reply.code(400).send({
          statusCode: 400,
          error: 'Bad Request',
          message: 'title, description, payment, category, city, and deadline are required',
        })
      }

      if (title.length > MAX_GIG_TITLE_LENGTH) {
        return reply.code(400).send({
          statusCode: 400,
          error: 'Bad Request',
          message: `Title must be at most ${MAX_GIG_TITLE_LENGTH} characters`,
        })
      }

      if (description.length > MAX_GIG_DESCRIPTION_LENGTH) {
        return reply.code(400).send({
          statusCode: 400,
          error: 'Bad Request',
          message: `Description must be at most ${MAX_GIG_DESCRIPTION_LENGTH} characters`,
        })
      }

      if (!isValidPayment(payment)) {
        return reply.code(400).send({
          statusCode: 400,
          error: 'Bad Request',
          message: 'Payment amount is out of valid range',
        })
      }

      const [gig] = await fastify.db
        .insert(gigs)
        .values({
          poster_id: request.user.id,
          title,
          description,
          payment,
          category,
          city,
          address,
          deadline: new Date(deadline),
          status: 'open',
        })
        .returning()

      return reply.code(201).send(gig)
    }
  )
}

export default gigsRoutes
