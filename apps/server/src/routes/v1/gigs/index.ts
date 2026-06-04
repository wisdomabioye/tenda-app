/**
 * Gig browse surface (cutover §3 rewrite): the public feed reads
 * escrows ⨝ gig_details ⨝ users. Read-only — creation and transitions
 * live under /v1/escrows.
 */
import { FastifyPluginAsync } from 'fastify'
import { eq, and, gt, gte, isNull, lte, or, asc, desc, sql, type SQL } from 'drizzle-orm'
import { escrows, gig_details, users } from '@tenda/shared/db/schema'
import {
  isValidLatitude,
  isValidLongitude,
  MAX_PAGINATION_LIMIT,
  LOCATIONS,
  GIG_CATEGORIES,
  ErrorCode,
} from '@tenda/shared'
import type { GigsContract, ApiError, GigCategory } from '@tenda/shared'
import { isAmountRaw } from '@server/chains/types'
import { AppError } from '@server/lib/errors'
import { gigSearchCondition, gigSearchRank } from '@server/lib/gig-search'
import { GIG_SUMMARY_COLS, toGigSummary } from '@server/lib/gig-read'

type ListRoute = GigsContract['list']

const gigsRoutes: FastifyPluginAsync = async (fastify) => {
  // GET /v1/gigs — list open gigs with filters
  fastify.get<{
    Querystring: ListRoute['query']
    Reply: ListRoute['response'] | ApiError
  }>('/', async (request) => {
    const {
      country,
      remote,
      cross_border,
      city,
      category,
      q,
      min_amount_raw,
      max_amount_raw,
      sort,
      lat,
      lng,
      radius_km,
      limit = 20,
      offset = 0,
    } = request.query

    if (country && !(country in LOCATIONS)) {
      throw new AppError(
        400,
        ErrorCode.VALIDATION_ERROR,
        `country must be one of: ${Object.keys(LOCATIONS).join(', ')}`,
      )
    }

    const safeLimit = Math.min(Number(limit), MAX_PAGINATION_LIMIT)
    const safeOffset = Number(offset)

    const now = new Date()
    const conditions: SQL[] = [
      eq(escrows.kind, 'gig'),
      // Public feed shows only open gigs whose accept window hasn't
      // passed — display-correct even between expire-escrows job ticks.
      eq(escrows.status, 'open'),
      or(isNull(escrows.accept_deadline), gt(escrows.accept_deadline, now)) as SQL,
    ]

    if (country) conditions.push(eq(gig_details.country, country))
    if (String(remote) === 'true') conditions.push(eq(gig_details.remote, true))
    if (String(remote) === 'false') conditions.push(eq(gig_details.remote, false))
    if (String(cross_border) === 'true') conditions.push(eq(gig_details.cross_border, true))
    if (city) conditions.push(eq(gig_details.city, city))
    if (category) {
      if (!GIG_CATEGORIES.includes(category as GigCategory)) {
        throw new AppError(
          400,
          ErrorCode.VALIDATION_ERROR,
          `category must be one of: ${GIG_CATEGORIES.join(', ')}`,
        )
      }
      conditions.push(eq(gig_details.category, category))
    }

    // S5.3 full-text search over title + description.
    if (q !== undefined && q.trim() !== '') conditions.push(gigSearchCondition(q))

    if (min_amount_raw !== undefined && !isAmountRaw(min_amount_raw)) {
      throw new AppError(400, ErrorCode.VALIDATION_ERROR, 'min_amount_raw must be a decimal integer string')
    }
    if (max_amount_raw !== undefined && !isAmountRaw(max_amount_raw)) {
      throw new AppError(400, ErrorCode.VALIDATION_ERROR, 'max_amount_raw must be a decimal integer string')
    }
    if (min_amount_raw !== undefined && max_amount_raw !== undefined && BigInt(min_amount_raw) > BigInt(max_amount_raw)) {
      throw new AppError(400, ErrorCode.VALIDATION_ERROR, 'min_amount_raw must be ≤ max_amount_raw')
    }
    if (min_amount_raw !== undefined) conditions.push(gte(escrows.amount_raw, min_amount_raw))
    if (max_amount_raw !== undefined) conditions.push(lte(escrows.amount_raw, max_amount_raw))

    // Validate and apply geographic proximity filter (haversine).
    // All three params must be provided together and within valid ranges.
    if (lat !== undefined || lng !== undefined || radius_km !== undefined) {
      const latN = Number(lat)
      const lngN = Number(lng)
      const rN = Number(radius_km)
      if (
        lat === undefined ||
        lng === undefined ||
        radius_km === undefined ||
        !isValidLatitude(latN) ||
        !isValidLongitude(lngN) ||
        isNaN(rN) ||
        rN <= 0 ||
        rN > 20_000
      ) {
        throw new AppError(
          400,
          ErrorCode.VALIDATION_ERROR,
          'lat (−90–90), lng (−180–180), and radius_km (0–20000) must all be provided and valid',
        )
      }
      // @todo Migrate to PostGIS ST_DWithin when query volume grows
      conditions.push(
        sql`${gig_details.latitude} IS NOT NULL AND ${gig_details.longitude} IS NOT NULL AND
          (6371 * acos(
            cos(radians(${latN})) * cos(radians(${gig_details.latitude})) *
            cos(radians(${gig_details.longitude}) - radians(${lngN})) +
            sin(radians(${latN})) * sin(radians(${gig_details.latitude}))
          )) <= ${rN}`,
      )
    }

    const where = and(...conditions)

    // Relevance ordering when searching (unless the caller picked a sort).
    let orderBy
    if (sort === 'amount_asc') orderBy = asc(escrows.amount_raw)
    else if (sort === 'amount_desc') orderBy = desc(escrows.amount_raw)
    else if (q !== undefined && q.trim() !== '') orderBy = desc(gigSearchRank(q))
    else orderBy = desc(escrows.created_at)

    const [data, countResult] = await Promise.all([
      fastify.db
        .select(GIG_SUMMARY_COLS)
        .from(escrows)
        .innerJoin(gig_details, eq(gig_details.escrow_id, escrows.id))
        .innerJoin(users, eq(users.id, escrows.creator_id))
        .where(where)
        .limit(safeLimit)
        .offset(safeOffset)
        .orderBy(orderBy),
      fastify.db
        .select({ count: sql<number>`count(*)::int` })
        .from(escrows)
        .innerJoin(gig_details, eq(gig_details.escrow_id, escrows.id))
        .where(where),
    ])

    return {
      data: data.map(toGigSummary),
      total: countResult[0].count,
      limit: safeLimit,
      offset: safeOffset,
    }
  })
}

export default gigsRoutes
