import { FastifyPluginAsync } from 'fastify'
import { eq, isNull, desc, sql } from 'drizzle-orm'
import type { UserRole } from '@tenda/shared'
import { users, gigs, disputes, platform_config } from '@tenda/shared/db/schema'
import { ErrorCode, MAX_PAGINATION_LIMIT } from '@tenda/shared'
import type { ApiError } from '@tenda/shared'
import { requireRole } from '../../../lib/guards'
import { invalidatePlatformConfigCache } from '../../../lib/platform'

const admin: FastifyPluginAsync = async (fastify) => {
  // All admin routes require a valid JWT with role === 'admin'
  const adminGuard = [fastify.authenticate, requireRole('admin')]

  // ── GET /v1/admin/disputes ─────────────────────────────────────────────
  // List open (unresolved) disputes with gig title and raiser info for triage.
  fastify.get<{
    Querystring: { limit?: number; offset?: number }
    Reply: { data: unknown[]; total: number; limit: number; offset: number } | ApiError
  }>('/disputes', { preHandler: adminGuard }, async (request) => {
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
  }>('/users/:id/status', { preHandler: adminGuard }, async (request, reply) => {
    const { id } = request.params
    const { status } = request.body

    if (status !== 'active' && status !== 'suspended') {
      return reply.code(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: 'status must be "active" or "suspended"',
        code: ErrorCode.VALIDATION_ERROR,
      })
    }

    const [updated] = await fastify.db
      .update(users)
      .set({ status, updated_at: new Date() })
      .where(eq(users.id, id))
      .returning({ id: users.id, status: users.status })

    if (!updated) {
      return reply.code(404).send({
        statusCode: 404,
        error: 'Not Found',
        message: 'User not found',
        code: ErrorCode.USER_NOT_FOUND,
      })
    }

    return updated
  })

  // ── PATCH /v1/admin/users/:id/role ────────────────────────────────────
  // Promote or demote a user. The change takes effect on their next login
  // (JWT is re-issued with the updated role on /auth/wallet).
  fastify.patch<{
    Params: { id: string }
    Body: { role: UserRole }
    Reply: { id: string; role: string } | ApiError
  }>('/users/:id/role', { preHandler: adminGuard }, async (request, reply) => {
    const { id } = request.params
    const { role } = request.body

    if (role !== 'user' && role !== 'admin') {
      return reply.code(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: 'role must be "user" or "admin"',
        code: ErrorCode.VALIDATION_ERROR,
      })
    }

    // Prevent an admin from accidentally demoting themselves
    if (id === request.user.id && role !== 'admin') {
      return reply.code(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: 'Cannot demote your own account',
        code: ErrorCode.FORBIDDEN,
      })
    }

    const [updated] = await fastify.db
      .update(users)
      .set({ role, updated_at: new Date() })
      .where(eq(users.id, id))
      .returning({ id: users.id, role: users.role })

    if (!updated) {
      return reply.code(404).send({
        statusCode: 404,
        error: 'Not Found',
        message: 'User not found',
        code: ErrorCode.USER_NOT_FOUND,
      })
    }

    fastify.log.info({ adminId: request.user.id, targetId: id, newRole: role }, 'User role changed')

    return updated
  })

  // ── GET /v1/admin/platform-config ─────────────────────────────────────
  fastify.get('/platform-config', { preHandler: adminGuard }, async () => {
    const [row] = await fastify.db.select().from(platform_config).limit(1)
    return row
  })

  // ── PATCH /v1/admin/platform-config ───────────────────────────────────
  // Update fee or grace period. Invalidates the in-process cache so the
  // next request reads fresh values immediately.
  fastify.patch<{
    Body: { fee_bps?: number; grace_period_seconds?: number }
    Reply: unknown | ApiError
  }>('/platform-config', { preHandler: adminGuard }, async (request, reply) => {
    const { fee_bps, grace_period_seconds } = request.body

    // fee_bps: 0–10000 (0%–100% in basis points)
    if (fee_bps !== undefined && (fee_bps < 0 || fee_bps > 10_000 || !Number.isInteger(fee_bps))) {
      return reply.code(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: 'fee_bps must be an integer between 0 and 10000',
        code: ErrorCode.VALIDATION_ERROR,
      })
    }

    if (grace_period_seconds !== undefined && (grace_period_seconds < 0 || !Number.isInteger(grace_period_seconds))) {
      return reply.code(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: 'grace_period_seconds must be a non-negative integer',
        code: ErrorCode.VALIDATION_ERROR,
      })
    }

    if (fee_bps === undefined && grace_period_seconds === undefined) {
      return reply.code(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: 'Provide at least one of fee_bps or grace_period_seconds',
        code: ErrorCode.VALIDATION_ERROR,
      })
    }

    const updates: Record<string, unknown> = { updated_at: new Date() }
    if (fee_bps !== undefined)              updates.fee_bps              = fee_bps
    if (grace_period_seconds !== undefined) updates.grace_period_seconds = grace_period_seconds

    const [updated] = await fastify.db
      .update(platform_config)
      .set(updates)
      .where(eq(platform_config.id, 1))
      .returning()

    // Flush the 5-minute cache so routes pick up the new values immediately
    invalidatePlatformConfigCache()

    return updated
  })
}

export default admin
