/**
 * Gig surface (cutover §3 rewrite): listings + create-detail only.
 *   GET  /, the public feed over escrows ⨝ gig_details ⨝ users.
 *   POST /, attach gig_details to the caller's DRAFT escrow (the
 *            chain-agnostic core is created by POST /v1/escrows first;
 *            this satellite carries the human-facing listing fields and
 *            runs the Stage-6 moderation gate).
 * Transitions live under /v1/escrows/:id/*.
 */
import { FastifyPluginAsync } from 'fastify'
import { clampLimit, clampOffset } from '@server/lib/pagination'
import { eq, and, gt, gte, isNull, lte, or, asc, desc, sql, type SQL } from 'drizzle-orm'
import { escrows, gig_details, users } from '@tenda/shared/db/schema'
import {
  isValidLatitude,
  isValidLongitude,
  MAX_GIG_DESCRIPTION_LENGTH,
  
  ASSET_META,
  LOCATIONS,
  GIG_CATEGORIES,
  ErrorCode,
} from '@tenda/shared'
import type { GigsContract, ApiError, GigCategory } from '@tenda/shared'
import { isAmountRaw } from '@server/chains/types'
import { AppError } from '@server/lib/errors'
import { validateGigDetails } from '@server/lib/gig-details'
import { gigSearchCondition, gigSearchRank } from '@server/lib/gig-search'
import { GIG_SUMMARY_COLS, toGigSummary } from '@server/lib/gig-read'
import { loadEscrowOr404 } from '@server/lib/escrow-routes'
import { moderateGig } from '@server/features/moderation/service'
import { buildModerationDeps } from '@server/features/moderation/store'

type ListRoute = GigsContract['list']
type CreateRoute = GigsContract['create']

const gigsRoutes: FastifyPluginAsync = async (fastify) => {
  // GET /v1/gigs, list open gigs with filters
  fastify.get<{
    Querystring: ListRoute['query']
    Reply: ListRoute['response'] | ApiError
  }>('/', async (request, reply) => {
    const {
      country,
      remote,
      cross_border,
      city,
      category,
      q,
      mine,
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

    const safeLimit = clampLimit(Number(limit))
    const safeOffset = clampOffset(Number(offset))

    const now = new Date()
    const conditions: SQL[] = [eq(escrows.kind, 'gig')]

    if (mine !== undefined) {
      // Own listings (my-gigs surface): every status incl. drafts, auth
      // required; identity comes from the JWT, never a param.
      if (mine !== 'created' && mine !== 'working') {
        throw new AppError(400, ErrorCode.VALIDATION_ERROR, "mine must be 'created' or 'working'")
      }
      // Full authenticate (not bare jwtVerify) so suspended accounts are
      // rejected here exactly like every other authenticated surface.
      await fastify.authenticate(request, reply)
      if (reply.sent) return reply
      const userId = request.user.id
      conditions.push(
        mine === 'created'
          ? eq(escrows.creator_id, userId)
          : (or(
              eq(escrows.counterparty_id, userId),
              eq(escrows.assigned_counterparty_id, userId),
            ) as SQL),
      )
    } else {
      // Public feed shows only open gigs whose accept window hasn't
      // passed, display-correct even between expire-escrows job ticks.
      // Taken-down listings (CO1) never surface here; the owner still sees
      // them through mine= above.
      conditions.push(
        eq(escrows.status, 'open'),
        eq(escrows.hidden, false),
        or(isNull(escrows.accept_deadline), gt(escrows.accept_deadline, now)) as SQL,
      )
    }

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

  // POST /v1/gigs, attach listing details to the caller's draft escrow.
  // Upsert while draft so a retry after a validation/moderation fix never
  // 409s; once the create tx confirms (draft → open) the satellite is
  // immutable through this route. Field validation lives in
  // lib/gig-details.ts; this handler owns the DB guards + moderation gate.
  fastify.post<{
    Body: CreateRoute['body']
    Reply: CreateRoute['response'] | ApiError
  }>('/', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const body = request.body ?? {}
    if (typeof body.escrow_id !== 'string' || body.escrow_id === '') {
      throw new AppError(400, ErrorCode.VALIDATION_ERROR, 'escrow_id is required')
    }

    const escrow = await loadEscrowOr404(fastify.db, body.escrow_id)
    if (escrow.creator_id !== request.user.id) {
      throw new AppError(403, ErrorCode.FORBIDDEN, 'Only the escrow creator can attach gig details')
    }
    if (escrow.kind !== 'gig') {
      throw new AppError(409, ErrorCode.ESCROW_WRONG_STATUS, 'Details can only be attached to gig escrows')
    }
    if (escrow.status !== 'draft') {
      throw new AppError(409, ErrorCode.ESCROW_WRONG_STATUS, 'Details can only be attached while the escrow is a draft')
    }

    // Creator's stored country (JWT country can be up to 7 days stale).
    const [creator] = await fastify.db
      .select({ country: users.country })
      .from(users)
      .where(eq(users.id, request.user.id))
      .limit(1)

    const details = validateGigDetails(body, creator?.country ?? null)

    // Stage-6 gate: block verdicts never reach the feed; warns pass with
    // the verdict recorded for the admin queue.
    const verdict = await moderateGig(
      buildModerationDeps(fastify),
      {
        title: details.title,
        description: (details.description ?? '').slice(0, MAX_GIG_DESCRIPTION_LENGTH),
        category: details.category,
        // Remote gigs persist no country; for price-sanity stats fall back to
        // the poster's market (moderation-only, never stored on the gig).
        country: details.country ?? creator?.country ?? '',
        asset: escrow.asset,
        amount_raw: escrow.amount_raw,
        asset_decimals: ASSET_META[escrow.asset]?.decimals ?? 0,
      },
      { kind: 'gig_published', id: escrow.id },
    )
    if (verdict.decision === 'block') {
      throw new AppError(400, ErrorCode.CONTENT_MODERATED, verdict.reasons.join('; ') || 'Content not allowed')
    }

    const values = { escrow_id: escrow.id, ...details }
    const [row] = await fastify.db
      .insert(gig_details)
      .values(values)
      .onConflictDoUpdate({ target: gig_details.escrow_id, set: values })
      .returning()

    return reply.code(201).send(row)
  })
}

export default gigsRoutes
