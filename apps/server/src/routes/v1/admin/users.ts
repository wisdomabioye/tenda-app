import { FastifyPluginAsync } from 'fastify'
import { eq, ilike, or, and, desc, sql, SQL } from 'drizzle-orm'
import { users } from '@tenda/shared/db/schema'
import {
  ADMIN_ROLES, ASSIGNABLE_ROLES, ErrorCode, MAX_PAGINATION_LIMIT,
} from '@tenda/shared'
import { requireRole } from '@server/lib/guards'
import { AppError } from '@server/lib/errors'
import { ensureTxUpdated } from '@server/lib/gigs'
import { appEvents } from '@server/lib/events'
import type { ApiError, UserRole, UserStatus } from '@tenda/shared'

const USER_MGMT_ROLES = ['support', 'moderator', 'dispute_resolver', 'super_admin'] as const

const adminUsers: FastifyPluginAsync = async (fastify) => {
  // GET /v1/admin/users — list users (role: support, moderator, dispute_resolver, super_admin)
  // marketing and finance are excluded per Fix #23 (no PII access)
  fastify.get<{
    Querystring: { status?: string; role?: string; search?: string; limit?: number; offset?: number }
    Reply: { data: unknown[]; total: number; limit: number; offset: number } | ApiError
  }>('/', { 
    preHandler: [requireRole(...USER_MGMT_ROLES)] 
  }, async (request) => {
    const { status, role, search, limit = 20, offset = 0 } = request.query
    const safeLimit  = Math.min(Number(limit), MAX_PAGINATION_LIMIT)
    const safeOffset = Number(offset)

    const conditions: SQL[] = []

    if (status === 'active' || status === 'suspended') {
      conditions.push(eq(users.status, status as UserStatus))
    }

    if (role && ADMIN_ROLES.includes(role as typeof ADMIN_ROLES[number]) || role === 'user') {
      conditions.push(eq(users.role, role as UserRole))
    }

    if (search && search.trim().length > 0) {
      const pattern = `%${search.trim()}%`
      conditions.push(
        or(
          ilike(users.first_name,     pattern),
          ilike(users.last_name,      pattern),
          ilike(users.wallet_address, pattern),
        )!,
      )
    }

    const where = conditions.length > 0 ? and(...conditions) : undefined

    const [data, countResult] = await Promise.all([
      fastify.db
        .select({
          id:               users.id,
          first_name:       users.first_name,
          last_name:        users.last_name,
          wallet_address:   users.wallet_address,
          role:             users.role,
          status:           users.status,
          is_seeker:        users.is_seeker,
          country:          users.country,
          city:             users.city,
          reputation_score: users.reputation_score,
          created_at:       users.created_at,
          last_active_at:   users.last_active_at,
        })
        .from(users)
        .where(where)
        .orderBy(desc(users.created_at))
        .limit(safeLimit)
        .offset(safeOffset),
      fastify.db
        .select({ count: sql<number>`count(*)::int` })
        .from(users)
        .where(where),
    ])

    return { data, total: countResult[0].count, limit: safeLimit, offset: safeOffset }
  })

  // GET /v1/admin/users/:id — full user detail (same PII restriction as list)
  fastify.get<{
    Params: { id: string }
    Reply: unknown | ApiError
  }>('/:id', { 
    preHandler: [requireRole(...USER_MGMT_ROLES)] 
  }, async (request) => {
    const { id } = request.params

    const [user] = await fastify.db
      .select()
      .from(users)
      .where(eq(users.id, id))
      .limit(1)

    if (!user) throw new AppError(404, ErrorCode.USER_NOT_FOUND, 'User not found')

    return user
  })

  // PATCH /v1/admin/users/:id/status — suspend or reinstate (role: support, moderator, super_admin)
  fastify.patch<{
    Params: { id: string }
    Body:   { status: 'active' | 'suspended' }
    Reply:  { id: string; status: string } | ApiError
  }>('/:id/status', { preHandler: [requireRole('support', 'moderator', 'super_admin')] }, async (request) => {
    const { id } = request.params
    const { status } = request.body

    if (status !== 'active' && status !== 'suspended') {
      throw new AppError(400, ErrorCode.VALIDATION_ERROR, 'status must be "active" or "suspended"')
    }

    const [target] = await fastify.db
      .select({ id: users.id, role: users.role, status: users.status })
      .from(users)
      .where(eq(users.id, id))
      .limit(1)

    if (!target) throw new AppError(404, ErrorCode.USER_NOT_FOUND, 'User not found')

    if (ADMIN_ROLES.includes(target.role as typeof ADMIN_ROLES[number]) && status === 'suspended') {
      throw new AppError(403, ErrorCode.FORBIDDEN, 'Cannot suspend another admin account')
    }

    const [updated] = await fastify.db
      .update(users)
      .set({ status, updated_at: new Date() })
      .where(eq(users.id, id))
      .returning({ id: users.id, status: users.status })

    const result = ensureTxUpdated(updated, 'User not found')

    appEvents.emit(
      status === 'suspended' ? 'admin.suspend_user' : 'admin.reinstate_user',
      { adminId: request.user.id, adminWallet: request.user.wallet_address, adminRole: request.user.role, userId: id, previousStatus: target.status },
    )

    return result
  })

  // PATCH /v1/admin/users/:id/role — promote or demote a user
  fastify.patch<{
    Params: { id: string }
    Body:   { role: UserRole }
    Reply:  { id: string; role: string } | ApiError
  }>('/:id/role', { 
    preHandler: [requireRole('super_admin')] 
  }, async (request) => {
    const { id } = request.params
    const { role } = request.body

    if (!ASSIGNABLE_ROLES.includes(role)) {
      throw new AppError(400, ErrorCode.VALIDATION_ERROR, `role must be one of: ${ASSIGNABLE_ROLES.join(', ')}`)
    }

    if (id === request.user.id && role === 'user') {
      throw new AppError(403, ErrorCode.FORBIDDEN, 'Cannot demote your own account')
    }

    const [current] = await fastify.db
      .select({ id: users.id, role: users.role })
      .from(users)
      .where(eq(users.id, id))
      .limit(1)

    if (!current) throw new AppError(404, ErrorCode.USER_NOT_FOUND, 'User not found')

    const [updated] = await fastify.db
      .update(users)
      .set({ role, updated_at: new Date() })
      .where(eq(users.id, id))
      .returning({ id: users.id, role: users.role })

    const result = ensureTxUpdated(updated, 'User not found')

    appEvents.emit('admin.change_role', {
      adminId:      request.user.id,
      adminWallet:  request.user.wallet_address,
      adminRole:    request.user.role,
      userId:       id,
      previousRole: current.role,
      newRole:      role,
    })

    return result
  })
}

export default adminUsers
