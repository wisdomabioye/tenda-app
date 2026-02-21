import { FastifyPluginAsync } from 'fastify'
import { eq, and, sql, SQL } from 'drizzle-orm'
import { gigs } from '@tenda/shared/db/schema'
import {
  isValidPaymentLamports,
  isValidCompletionDuration,
  validateGigDeadlines,
  MAX_GIG_TITLE_LENGTH,
  MAX_GIG_DESCRIPTION_LENGTH,
} from '@tenda/shared'
import type { GigsContract, ApiError, GigStatus, GigCategory } from '@tenda/shared'

type ListRoute    = GigsContract['list']
type CreateRoute  = GigsContract['create']

const gigsRoutes: FastifyPluginAsync = async (fastify) => {

  // GET /v1/gigs — list with filters
  fastify.get<{
    Querystring: ListRoute['query']
    Reply: ListRoute['response']
  }>('/', async (request) => {
    const { city, category, limit = 20, offset = 0 } = request.query

    const conditions: SQL[] = [
      // public feed is always open gigs only
      eq(gigs.status, 'open' as GigStatus),
    ]
    if (city)     conditions.push(eq(gigs.city, city))
    if (category) conditions.push(eq(gigs.category, category as GigCategory))

    const where = and(...conditions)

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

  // POST /v1/gigs — create gig (saved as draft)
  fastify.post<{
    Body: CreateRoute['body']
    Reply: CreateRoute['response'] | ApiError
  }>(
    '/',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const {
        title,
        description,
        payment_lamports,
        category,
        city,
        address,
        latitude,
        longitude,
        completion_duration_seconds,
        accept_deadline,
      } = request.body

      if (!title || !description || !payment_lamports || !category || !city || !completion_duration_seconds) {
        return reply.code(400).send({
          statusCode: 400,
          error: 'Bad Request',
          message: 'title, description, payment_lamports, category, city, and completion_duration_seconds are required',
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

      if (!isValidPaymentLamports(payment_lamports)) {
        return reply.code(400).send({
          statusCode: 400,
          error: 'Bad Request',
          message: 'payment_lamports is out of valid range',
        })
      }

      if (!isValidCompletionDuration(completion_duration_seconds)) {
        return reply.code(400).send({
          statusCode: 400,
          error: 'Bad Request',
          message: 'completion_duration_seconds must be between 3600 (1 hour) and 7776000 (90 days)',
        })
      }

      const deadlineCheck = validateGigDeadlines(completion_duration_seconds, accept_deadline ?? null)
      if (!deadlineCheck.valid) {
        return reply.code(400).send({
          statusCode: 400,
          error: 'Bad Request',
          message: deadlineCheck.error!,
        })
      }

      const [gig] = await fastify.db
        .insert(gigs)
        .values({
          poster_id: request.user.id,
          title,
          description,
          payment_lamports,
          category: category as GigCategory,
          city,
          address,
          latitude,
          longitude,
          completion_duration_seconds,
          accept_deadline: accept_deadline ? new Date(accept_deadline) : null,
          status: 'draft',
        })
        .returning()

      return reply.code(201).send(gig)
    }
  )
}

export default gigsRoutes
