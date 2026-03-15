import { FastifyPluginAsync } from 'fastify'
import { and, eq, isNull, desc, sql } from 'drizzle-orm'
import type { UserRole } from '@tenda/shared'
import { users, gigs, disputes, platform_config, blocked_keywords, reports } from '@tenda/shared/db/schema'
import { ErrorCode, MAX_PAGINATION_LIMIT, REPORT_STATUSES, REPORT_CONTENT_TYPES } from '@tenda/shared'
import type { ApiError, ReportStatus, ReportContentType } from '@tenda/shared'
import { requireRole } from '@server/lib/guards'
import { invalidatePlatformConfigCache } from '@server/lib/platform'
import { AppError } from '@server/lib/errors'
import { ensureTxUpdated } from '@server/lib/gigs'

const admin: FastifyPluginAsync = async (fastify) => {
  // Guard every route in this plugin scope with JWT + admin role.
  // Using hooks instead of per-route preHandler ensures any future route
  // added to this file is automatically protected — no per-route opt-in required.
  fastify.addHook('preHandler', fastify.authenticate)
  fastify.addHook('preHandler', requireRole('admin'))

  // ── GET /v1/admin/disputes ─────────────────────────────────────────────
  // List open (unresolved) disputes with gig title and raiser info for triage.
  fastify.get<{
    Querystring: { limit?: number; offset?: number }
    Reply: { data: unknown[]; total: number; limit: number; offset: number } | ApiError
  }>('/disputes', async (request) => {
    const { limit = 20, offset = 0 } = request.query
    const safeLimit  = Math.min(Number(limit), MAX_PAGINATION_LIMIT)
    const safeOffset = Number(offset)

    const where = isNull(disputes.resolved_at)

    const [data, countResult] = await Promise.all([
      fastify.db
        .select({
          id:                    disputes.id,
          gig_id:                disputes.gig_id,
          gig_title:             gigs.title,
          raised_by_id:          disputes.raised_by_id,
          raised_by_first_name:  users.first_name,
          raised_by_last_name:   users.last_name,
          reason:                disputes.reason,
          raised_at:             disputes.raised_at,
        })
        .from(disputes)
        .innerJoin(gigs,  eq(disputes.gig_id,      gigs.id))
        .innerJoin(users, eq(disputes.raised_by_id, users.id))
        .where(where)
        .orderBy(desc(disputes.raised_at))
        .limit(safeLimit)
        .offset(safeOffset),
      fastify.db
        .select({ count: sql<number>`count(*)::int` })
        .from(disputes)
        .where(where),
    ])

    return { data, total: countResult[0].count, limit: safeLimit, offset: safeOffset }
  })

  // ── PATCH /v1/admin/users/:id/status ──────────────────────────────────
  // Suspend or reinstate a user. Suspension takes effect within 60 seconds
  // (the authenticate decorator's status-cache TTL).
  fastify.patch<{
    Params: { id: string }
    Body: { status: 'active' | 'suspended' }
    Reply: { id: string; status: string } | ApiError
  }>('/users/:id/status', async (request) => {
    const { id } = request.params
    const { status } = request.body

    if (status !== 'active' && status !== 'suspended') {
      throw new AppError(400, ErrorCode.VALIDATION_ERROR, 'status must be "active" or "suspended"')
    }

    // Fetch the target user's role before updating — admins cannot suspend other admins.
    const [target] = await fastify.db
      .select({ id: users.id, role: users.role })
      .from(users)
      .where(eq(users.id, id))
      .limit(1)

    if (!target) throw new AppError(404, ErrorCode.USER_NOT_FOUND, 'User not found')

    if (target.role === 'admin' && status === 'suspended') {
      throw new AppError(403, ErrorCode.FORBIDDEN, 'Cannot suspend another admin account')
    }

    const [updated] = await fastify.db
      .update(users)
      .set({ status, updated_at: new Date() })
      .where(eq(users.id, id))
      .returning({ id: users.id, status: users.status })

    const result = ensureTxUpdated(updated, 'User not found')

    fastify.log.info({ adminId: request.user.id, targetId: id, newStatus: status }, 'User status changed')

    return result
  })

  // ── PATCH /v1/admin/users/:id/role ────────────────────────────────────
  // Promote or demote a user. The change takes effect on their next login
  // (JWT is re-issued with the updated role on /auth/wallet).
  fastify.patch<{
    Params: { id: string }
    Body: { role: UserRole }
    Reply: { id: string; role: string } | ApiError
  }>('/users/:id/role', async (request) => {
    const { id } = request.params
    const { role } = request.body

    if (role !== 'user' && role !== 'admin') {
      throw new AppError(400, ErrorCode.VALIDATION_ERROR, 'role must be "user" or "admin"')
    }

    // Prevent an admin from accidentally demoting themselves
    if (id === request.user.id && role !== 'admin') {
      throw new AppError(400, ErrorCode.FORBIDDEN, 'Cannot demote your own account')
    }

    const [updated] = await fastify.db
      .update(users)
      .set({ role, updated_at: new Date() })
      .where(eq(users.id, id))
      .returning({ id: users.id, role: users.role })

    const result = ensureTxUpdated(updated, 'User not found')

    fastify.log.info({ adminId: request.user.id, targetId: id, newRole: role }, 'User role changed')

    return result
  })

  // ── GET /v1/admin/platform-config ─────────────────────────────────────
  fastify.get('/platform-config', async () => {
    const [row] = await fastify.db.select().from(platform_config).limit(1)
    if (!row) throw new AppError(404, ErrorCode.INTERNAL_ERROR, 'Platform config not found — seed the database first')
    return row
  })

  // ── PATCH /v1/admin/platform-config ───────────────────────────────────
  // Update fee or grace period. Invalidates the in-process cache so the
  // next request reads fresh values immediately.
  fastify.patch<{
    Body: { fee_bps?: number; seeker_fee_bps?: number; grace_period_seconds?: number }
    Reply: unknown | ApiError
  }>('/platform-config', async (request) => {
    const { fee_bps, seeker_fee_bps, grace_period_seconds } = request.body

    // fee_bps / seeker_fee_bps: 0–10000 (0%–100% in basis points)
    if (fee_bps !== undefined && (fee_bps < 0 || fee_bps > 10_000 || !Number.isInteger(fee_bps))) {
      throw new AppError(400, ErrorCode.VALIDATION_ERROR, 'fee_bps must be an integer between 0 and 10000')
    }

    if (seeker_fee_bps !== undefined && (seeker_fee_bps < 0 || seeker_fee_bps > 10_000 || !Number.isInteger(seeker_fee_bps))) {
      throw new AppError(400, ErrorCode.VALIDATION_ERROR, 'seeker_fee_bps must be an integer between 0 and 10000')
    }

    // Cap at 30 days (2,592,000 s) to prevent accidentally setting an extreme grace period
    const MAX_GRACE_PERIOD_SECONDS = 30 * 24 * 60 * 60 // 30 days
    if (grace_period_seconds !== undefined && (
      grace_period_seconds < 0 ||
      !Number.isInteger(grace_period_seconds) ||
      grace_period_seconds > MAX_GRACE_PERIOD_SECONDS
    )) {
      throw new AppError(400, ErrorCode.VALIDATION_ERROR, `grace_period_seconds must be a non-negative integer ≤ ${MAX_GRACE_PERIOD_SECONDS} (30 days)`)
    }

    if (fee_bps === undefined && seeker_fee_bps === undefined && grace_period_seconds === undefined) {
      throw new AppError(400, ErrorCode.VALIDATION_ERROR, 'Provide at least one of fee_bps, seeker_fee_bps, or grace_period_seconds')
    }

    const updates: Record<string, unknown> = { updated_at: new Date() }
    if (fee_bps !== undefined)              updates.fee_bps              = fee_bps
    if (seeker_fee_bps !== undefined)       updates.seeker_fee_bps       = seeker_fee_bps
    if (grace_period_seconds !== undefined) updates.grace_period_seconds = grace_period_seconds

    const [updated] = await fastify.db
      .update(platform_config)
      .set(updates)
      .where(eq(platform_config.id, 1))
      .returning()

    const result = ensureTxUpdated(updated, 'Platform config not found — seed the database first')

    // Flush the 5-minute cache so routes pick up the new values immediately
    invalidatePlatformConfigCache()

    return result
  })

  // ── GET /v1/admin/blocked-keywords ────────────────────────────────────
  fastify.get('/blocked-keywords', async () => {
    return fastify.db
      .select({ id: blocked_keywords.id, keyword: blocked_keywords.keyword, added_by: blocked_keywords.added_by, created_at: blocked_keywords.created_at })
      .from(blocked_keywords)
      .orderBy(blocked_keywords.created_at)
  })

  // ── POST /v1/admin/blocked-keywords ───────────────────────────────────
  fastify.post<{
    Body: { keyword: string }
    Reply: { id: string; keyword: string } | ApiError
  }>('/blocked-keywords', async (request, reply) => {
    const { keyword } = request.body

    if (!keyword || keyword.trim().length === 0) {
      throw new AppError(400, ErrorCode.VALIDATION_ERROR, 'keyword is required')
    }

    const normalised = keyword.trim().toLowerCase()

    const [inserted] = await fastify.db
      .insert(blocked_keywords)
      .values({ keyword: normalised, added_by: request.user.id })
      .onConflictDoNothing()
      .returning({ id: blocked_keywords.id, keyword: blocked_keywords.keyword })

    if (!inserted) throw new AppError(409, ErrorCode.VALIDATION_ERROR, 'Keyword already exists')

    fastify.invalidateBlocklistCache()
    fastify.log.info({ adminId: request.user.id, keyword: normalised }, 'Blocked keyword added')

    return reply.code(201).send(inserted)
  })

  // ── DELETE /v1/admin/blocked-keywords/:id ─────────────────────────────
  fastify.delete<{ Params: { id: string } }>(
    '/blocked-keywords/:id',
    async (request, reply) => {
      const [deleted] = await fastify.db
        .delete(blocked_keywords)
        .where(eq(blocked_keywords.id, request.params.id))
        .returning({ id: blocked_keywords.id })

      if (!deleted) throw new AppError(404, ErrorCode.NOT_FOUND, 'Keyword not found')

      fastify.invalidateBlocklistCache()
      fastify.log.info({ adminId: request.user.id, keywordId: request.params.id }, 'Blocked keyword removed')

      return reply.code(204).send()
    },
  )

  // ── POST /v1/admin/blocked-keywords/refresh ───────────────────────────
  // Instant cache bust — use after bulk keyword imports or urgent additions.
  fastify.post('/blocked-keywords/refresh', async (_request, reply) => {
    fastify.invalidateBlocklistCache()
    return reply.code(204).send()
  })

  // ── GET /v1/admin/reports ─────────────────────────────────────────────
  fastify.get<{
    Querystring: { status?: ReportStatus; content_type?: string; limit?: number; offset?: number }
  }>('/reports', async (request) => {
    const { status, content_type, limit = 20, offset = 0 } = request.query
    const safeLimit  = Math.min(Number(limit), MAX_PAGINATION_LIMIT)
    const safeOffset = Number(offset)

    if (status && !REPORT_STATUSES.includes(status)) {
      return { data: [], total: 0, limit: safeLimit, offset: safeOffset }
    }

    if (content_type && !REPORT_CONTENT_TYPES.includes(content_type as ReportContentType)) {
      return { data: [], total: 0, limit: safeLimit, offset: safeOffset }
    }

    const conditions = [
      ...(status       ? [eq(reports.status,       status)]                              : []),
      ...(content_type ? [eq(reports.content_type, content_type as ReportContentType)]   : []),
    ]
    const where = conditions.length === 0 ? undefined
                : conditions.length === 1 ? conditions[0]
                : and(...conditions)

    const [data, countResult] = await Promise.all([
      fastify.db
        .select({
          id:               reports.id,
          reporter_id:      reports.reporter_id,
          reported_user_id: reports.reported_user_id,
          content_type:     reports.content_type,
          content_id:       reports.content_id,
          reason:           reports.reason,
          note:             reports.note,
          content_snapshot: reports.content_snapshot,
          status:           reports.status,
          admin_note:       reports.admin_note,
          reviewed_at:      reports.reviewed_at,
          created_at:       reports.created_at,
        })
        .from(reports)
        .where(where)
        .orderBy(desc(reports.created_at))
        .limit(safeLimit)
        .offset(safeOffset),
      fastify.db
        .select({ count: sql<number>`count(*)::int` })
        .from(reports)
        .where(where),
    ])

    return { data, total: countResult[0].count, limit: safeLimit, offset: safeOffset }
  })

  // ── PATCH /v1/admin/reports/:id ───────────────────────────────────────
  fastify.patch<{
    Params: { id: string }
    Body: { status: ReportStatus; admin_note?: string }
    Reply: unknown | ApiError
  }>('/reports/:id', async (request) => {
    const { status, admin_note } = request.body

    if (!REPORT_STATUSES.includes(status)) {
      throw new AppError(400, ErrorCode.VALIDATION_ERROR, `status must be one of: ${REPORT_STATUSES.join(', ')}`)
    }

    const [updated] = await fastify.db
      .update(reports)
      .set({ status, admin_note: admin_note ?? null, reviewed_at: new Date() })
      .where(eq(reports.id, request.params.id))
      .returning()

    const result = ensureTxUpdated(updated, 'Report not found')

    fastify.log.info({ adminId: request.user.id, reportId: request.params.id, newStatus: status }, 'Report reviewed')

    return result
  })
}

export default admin
