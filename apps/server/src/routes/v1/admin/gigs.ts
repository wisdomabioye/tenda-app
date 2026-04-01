import { FastifyPluginAsync } from 'fastify'
import { eq, and, desc, sql, SQL } from 'drizzle-orm'
import { gigs, users } from '@tenda/shared/db/schema'
import { ErrorCode, MAX_PAGINATION_LIMIT } from '@tenda/shared'
import { requireRole } from '@server/lib/guards'
import { AppError } from '@server/lib/errors'
import { ensureGigExists } from '@server/lib/gigs'
import { appEvents } from '@server/lib/events'
import type { ApiError, GigStatus, GigCategory } from '@tenda/shared'

// Role matrix: "Force-expire / hide gig" → support, moderator, super_admin
const MODERATION_ROLES = ['support', 'moderator', 'super_admin'] as const
// Expire is more destructive → support + super_admin only
const EXPIRE_ROLES = ['support', 'super_admin'] as const
const ESCROW_STATUSES = new Set<GigStatus>(['open', 'accepted'])
const ESCROW_NOTE = 'This gig has active escrow. The poster must claim their refund via the app.'

const adminGigs: FastifyPluginAsync = async (fastify) => {
  // GET /v1/admin/gigs — list all gigs (admin view, unfiltered by hidden/status)
  fastify.get<{
    Querystring: {
      status?: string; hidden?: string; category?: string
      country?: string; poster_id?: string; limit?: number; offset?: number
    }
    Reply: { data: unknown[]; total: number; limit: number; offset: number } | ApiError
  }>('/', async (request) => {
    const { status, hidden, category, country, poster_id, limit = 20, offset = 0 } = request.query
    const safeLimit  = Math.min(Number(limit), MAX_PAGINATION_LIMIT)
    const safeOffset = Number(offset)

    const conditions: SQL[] = []
    if (status)    conditions.push(eq(gigs.status,   status as GigStatus))
    if (category)  conditions.push(eq(gigs.category, category as GigCategory))
    if (country)   conditions.push(eq(gigs.country,  country))
    if (poster_id) conditions.push(eq(gigs.poster_id, poster_id))
    if (String(hidden) === 'true')  conditions.push(eq(gigs.hidden, true))
    if (String(hidden) === 'false') conditions.push(eq(gigs.hidden, false))

    const where = conditions.length > 0 ? and(...conditions) : undefined

    const [data, countResult] = await Promise.all([
      fastify.db
        .select({
          id:                gigs.id,
          title:             gigs.title,
          category:          gigs.category,
          status:            gigs.status,
          hidden:            gigs.hidden,
          country:           gigs.country,
          city:              gigs.city,
          payment_lamports:  gigs.payment_lamports,
          created_at:        gigs.created_at,
          poster_id:         gigs.poster_id,
          poster_first_name: users.first_name,
          poster_last_name:  users.last_name,
        })
        .from(gigs)
        .innerJoin(users, eq(gigs.poster_id, users.id))
        .where(where)
        .orderBy(desc(gigs.created_at))
        .limit(safeLimit)
        .offset(safeOffset),
      fastify.db
        .select({ count: sql<number>`count(*)::int` })
        .from(gigs)
        .where(where),
    ])

    return { data, total: countResult[0].count, limit: safeLimit, offset: safeOffset }
  })

  // GET /v1/admin/gigs/:id — gig detail (visible regardless of hidden/status)
  fastify.get<{
    Params: { id: string }
    Reply: unknown | ApiError
  }>('/:id', async (request) => {
    const { id } = request.params

    const gig = await ensureGigExists(fastify.db, id)

    const [poster] = await fastify.db
      .select({
        id:             users.id,
        first_name:     users.first_name,
        last_name:      users.last_name,
        wallet_address: users.wallet_address,
        role:           users.role,
        status:         users.status,
      })
      .from(users)
      .where(eq(users.id, gig.poster_id))
      .limit(1)

    return { ...gig, poster: poster ?? null }
  })

  // PATCH /v1/admin/gigs/:id/hide — role: support, moderator, super_admin
  fastify.patch<{
    Params: { id: string }
    Body:   { reason?: string }
    Reply:  { id: string; hidden: boolean; escrow_note?: string } | ApiError
  }>('/:id/hide', { 
    preHandler: [requireRole(...MODERATION_ROLES)] 
  }, async (request) => {
    const { id } = request.params
    const { reason } = request.body ?? {}

    const [updated] = await fastify.db
      .update(gigs)
      .set({ hidden: true, updated_at: new Date() })
      .where(eq(gigs.id, id))
      .returning({ id: gigs.id, hidden: gigs.hidden, status: gigs.status })

    if (!updated) throw new AppError(404, ErrorCode.GIG_NOT_FOUND, 'Gig not found')

    appEvents.emit('admin.hide_gig', {
      adminId:     request.user.id,
      adminWallet: request.user.wallet_address,
      adminRole:   request.user.role,
      gigId:       id,
      reason,
    })

    const { status, ...rest } = updated
    return ESCROW_STATUSES.has(status as GigStatus)
      ? { ...rest, escrow_note: ESCROW_NOTE }
      : rest
  })

  // PATCH /v1/admin/gigs/:id/unhide — role: support, moderator, super_admin
  fastify.patch<{
    Params: { id: string }
    Reply:  { id: string; hidden: boolean } | ApiError
  }>('/:id/unhide', { 
    preHandler: [requireRole(...MODERATION_ROLES)] 
  }, async (request) => {
    const { id } = request.params

    const [updated] = await fastify.db
      .update(gigs)
      .set({ hidden: false, updated_at: new Date() })
      .where(eq(gigs.id, id))
      .returning({ id: gigs.id, hidden: gigs.hidden })

    if (!updated) throw new AppError(404, ErrorCode.GIG_NOT_FOUND, 'Gig not found')

    appEvents.emit('admin.unhide_gig', {
      adminId:     request.user.id,
      adminWallet: request.user.wallet_address,
      adminRole:   request.user.role,
      gigId:       id,
    })

    return updated
  })

  // POST /v1/admin/gigs/:id/expire — force an open gig to expired status
  // role: support, super_admin — Fix #37: guards status = 'open' at DB level
  fastify.post<{
    Params: { id: string }
    Reply:  { id: string; status: string; escrow_note: string } | ApiError
  }>('/:id/expire', { 
    preHandler: [requireRole(...EXPIRE_ROLES)] 
  }, async (request) => {
    const { id } = request.params

    const [updated] = await fastify.db
      .update(gigs)
      .set({ status: 'expired', updated_at: new Date() })
      .where(and(eq(gigs.id, id), eq(gigs.status, 'open')))
      .returning({ id: gigs.id, status: gigs.status })

    if (!updated) {
      await ensureGigExists(fastify.db, id) // throws 404 if gig doesn't exist
      throw new AppError(409, ErrorCode.GIG_WRONG_STATUS, 'Gig must be open to be force-expired')
    }

    appEvents.emit('admin.force_expire_gig', {
      adminId:     request.user.id,
      adminWallet: request.user.wallet_address,
      adminRole:   request.user.role,
      gigId:       id,
    })

    // Escrow note always included — open gig always has escrowed funds
    return { ...updated, escrow_note: ESCROW_NOTE }
  })
}

export default adminGigs
