import { FastifyPluginAsync } from 'fastify'
import { eq, and, gte, lte, asc, desc, sql, SQL } from 'drizzle-orm'
import { gigs, users } from '@tenda/shared/db/schema'
import {
  isValidPaymentLamports,
  isValidCompletionDuration,
  isValidLatitude,
  isValidLongitude,
  validateGigDeadlines,
  isCrossBorder,
  MAX_GIG_TITLE_LENGTH,
  MAX_GIG_DESCRIPTION_LENGTH,
  MAX_PAGINATION_LIMIT,
  LOCATIONS,
  ErrorCode,
} from '@tenda/shared'
import type { GigsContract, ApiError, GigStatus, GigCategory, CountryCode } from '@tenda/shared'
import { batchExpireGigs } from '@server/lib/gigs'
import { AppError } from '@server/lib/errors'
import { ensureValidCoordinates } from '@server/lib/validation'
import { moderateBody } from '@server/lib/moderation'

type ListRoute   = GigsContract['list']
type CreateRoute = GigsContract['create']

const gigsRoutes: FastifyPluginAsync = async (fastify) => {

  // GET /v1/gigs — list open gigs with filters
  fastify.get<{
    Querystring: ListRoute['query']
    Reply: ListRoute['response'] | ApiError
  }>('/', async (request, _reply) => {
    // Batch-expire gigs whose deadlines have passed before serving the list.
    // Throttled internally to at most once per minute.
    await batchExpireGigs(fastify.db, fastify.log)

    const {
      country,
      remote,
      cross_border,
      city,
      category,
      min_payment_lamports,
      max_payment_lamports,
      sort,
      lat,
      lng,
      radius_km,
      limit  = 20,
      offset = 0,
    } = request.query

    if (country && !(country in LOCATIONS)) {
      throw new AppError(400, ErrorCode.VALIDATION_ERROR, `country must be one of: ${Object.keys(LOCATIONS).join(', ')}`)
    }

    const safeLimit  = Math.min(Number(limit),  MAX_PAGINATION_LIMIT)
    const safeOffset = Number(offset)

    const conditions: SQL[] = [
      // Public feed shows only open gigs. Expired gigs are excluded because
      // batchExpireGigs above updated their status before this query runs.
      eq(gigs.status, 'open' as GigStatus),
    ]

    if (country)                         conditions.push(eq(gigs.country, country))
    if (String(remote) === 'true')       conditions.push(eq(gigs.remote, true))
    if (String(remote) === 'false')      conditions.push(eq(gigs.remote, false))
    if (String(cross_border) === 'true') conditions.push(eq(gigs.cross_border, true))
    if (city)                            conditions.push(eq(gigs.city, city))
    if (category)                        conditions.push(eq(gigs.category, category as GigCategory))

    if (min_payment_lamports !== undefined || max_payment_lamports !== undefined) {
      const minN = min_payment_lamports ?? 0
      const maxN = max_payment_lamports ?? Number.MAX_SAFE_INTEGER
      if (!Number.isInteger(minN) || minN < 0 || !Number.isInteger(maxN) || maxN < 0 || minN > maxN) {
        throw new AppError(400, ErrorCode.VALIDATION_ERROR, 'min_payment_lamports and max_payment_lamports must be non-negative integers with min ≤ max')
      }
    }
    if (min_payment_lamports) conditions.push(gte(gigs.payment_lamports, min_payment_lamports))
    if (max_payment_lamports) conditions.push(lte(gigs.payment_lamports, max_payment_lamports))

    // Validate and apply geographic proximity filter (haversine).
    // All three params must be provided together and within valid ranges.
    // Uses named numeric locals so the SQL template receives narrowed number types.
    if (lat !== undefined || lng !== undefined || radius_km !== undefined) {
      const latN = Number(lat)
      const lngN = Number(lng)
      const rN   = Number(radius_km)
      if (
        lat === undefined || lng === undefined || radius_km === undefined ||
        !isValidLatitude(latN) || !isValidLongitude(lngN) ||
        isNaN(rN) || rN <= 0 || rN > 20_000
      ) {
        throw new AppError(400, ErrorCode.VALIDATION_ERROR, 'lat (−90–90), lng (−180–180), and radius_km (0–20000) must all be provided and valid')
      }
      // @todo Migrate to PostGIS ST_DWithin when query volume grows
      conditions.push(
        sql`${gigs.latitude} IS NOT NULL AND ${gigs.longitude} IS NOT NULL AND
          (6371 * acos(
            cos(radians(${latN})) * cos(radians(${gigs.latitude})) *
            cos(radians(${gigs.longitude}) - radians(${lngN})) +
            sin(radians(${latN})) * sin(radians(${gigs.latitude}))
          )) <= ${rN}`
      )
    }

    const where = and(...conditions)

    let orderBy
    if (sort === 'payment_asc')       orderBy = asc(gigs.payment_lamports)
    else if (sort === 'payment_desc') orderBy = desc(gigs.payment_lamports)
    else                              orderBy = desc(gigs.created_at)

    const [data, countResult] = await Promise.all([
      fastify.db
        .select()
        .from(gigs)
        .where(where)
        .limit(safeLimit)
        .offset(safeOffset)
        .orderBy(orderBy),
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

  // POST /v1/gigs — create gig (saved as draft)
  fastify.post<{
    Body: CreateRoute['body']
    Reply: CreateRoute['response'] | ApiError
  }>(
    '/',
    { preHandler: [fastify.authenticate, moderateBody<CreateRoute['body']>(fastify, ['title', 'description'])] },
    async (request, reply) => {
      const {
        title,
        description,
        payment_lamports,
        category,
        country,
        remote = false,
        city,
        address,
        latitude,
        longitude,
        completion_duration_seconds,
        accept_deadline,
      } = request.body

      if (!title || !description || !payment_lamports || !category || !completion_duration_seconds) {
        throw new AppError(400, ErrorCode.VALIDATION_ERROR, 'title, description, payment_lamports, category, and completion_duration_seconds are required')
      }

      if (!remote && !city) {
        throw new AppError(400, ErrorCode.VALIDATION_ERROR, 'city is required for non-remote gigs')
      }

      if (!remote && !country) {
        throw new AppError(400, ErrorCode.VALIDATION_ERROR, 'country is required for non-remote gigs')
      }

      // Fetch poster's current country from DB — JWT country can be up to 7 days stale.
      const [poster] = await fastify.db
        .select({ country: users.country })
        .from(users)
        .where(eq(users.id, request.user.id))
        .limit(1)
      const posterCountry = poster?.country ?? null

      // For remote gigs country is optional — fall back to poster's stored country.
      const resolvedCountry = (country ?? posterCountry) as CountryCode | null

      if (!resolvedCountry || !(resolvedCountry in LOCATIONS)) {
        throw new AppError(400, ErrorCode.VALIDATION_ERROR, `country must be one of: ${Object.keys(LOCATIONS).join(', ')}`)
      }

      if (title.length > MAX_GIG_TITLE_LENGTH) {
        throw new AppError(400, ErrorCode.VALIDATION_ERROR, `Title must be at most ${MAX_GIG_TITLE_LENGTH} characters`)
      }

      if (description.length > MAX_GIG_DESCRIPTION_LENGTH) {
        throw new AppError(400, ErrorCode.VALIDATION_ERROR, `Description must be at most ${MAX_GIG_DESCRIPTION_LENGTH} characters`)
      }

      if (!isValidPaymentLamports(payment_lamports)) {
        throw new AppError(400, ErrorCode.VALIDATION_ERROR, 'payment_lamports is out of valid range')
      }

      if (!isValidCompletionDuration(completion_duration_seconds)) {
        throw new AppError(400, ErrorCode.VALIDATION_ERROR, 'completion_duration_seconds must be between 3600 (1 hour) and 7776000 (90 days)')
      }

      ensureValidCoordinates(latitude, longitude)

      const deadlineCheck = validateGigDeadlines(completion_duration_seconds, accept_deadline ?? null)
      if (!deadlineCheck.valid) {
        throw new AppError(400, ErrorCode.VALIDATION_ERROR, deadlineCheck.error!)
      }

      const cross_border = isCrossBorder(remote, resolvedCountry, posterCountry)

      const [gig] = await fastify.db
        .insert(gigs)
        .values({
          poster_id: request.user.id,
          title,
          description,
          payment_lamports,
          category: category as GigCategory,
          country: resolvedCountry,
          cross_border,
          remote,
          city: remote ? null : city,
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
