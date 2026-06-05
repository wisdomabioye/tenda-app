import { FastifyPluginAsync } from 'fastify'
import { eq, inArray } from 'drizzle-orm'
import { device_tokens, users } from '@tenda/shared/db/schema'
import { ErrorCode } from '@tenda/shared'
import { requirePermission } from '@server/lib/guards'
import { AppError } from '@server/lib/errors'
import { appEvents } from '@server/lib/events'
import { sendPush } from '@server/lib/push'
import type { ApiError, UserRole } from '@tenda/shared'

// Valid broadcast target groups
type BroadcastTarget = 'all' | 'role' | 'country' | 'city'
const VALID_TARGETS: BroadcastTarget[] = ['all', 'role', 'country', 'city']


const adminPush: FastifyPluginAsync = async (fastify) => {
  // POST /v1/admin/push/broadcast
  // target: 'all' | 'role' | 'country' | 'city'
  // target_value: required when target != 'all' (role name, country code, city name)
  // Rate-limited: 10 broadcasts per hour to prevent runaway campaigns.
  fastify.post<{
    Body:  { title: string; body: string; target: string; target_value?: string; data?: Record<string, unknown> }
    Reply: { attempted: number } | ApiError
  }>('/broadcast', {
    preHandler: [requirePermission('push.broadcast')],
    config:     { rateLimit: { max: 10, timeWindow: '1 hour' } },
  }, async (request) => {
    const { title, body, target, target_value, data: pushData } = request.body

    if (!title || title.trim().length === 0) {
      throw new AppError(400, ErrorCode.VALIDATION_ERROR, 'title is required')
    }
    if (!body || body.trim().length === 0) {
      throw new AppError(400, ErrorCode.VALIDATION_ERROR, 'body is required')
    }
    if (!VALID_TARGETS.includes(target as BroadcastTarget)) {
      throw new AppError(400, ErrorCode.VALIDATION_ERROR, `target must be one of: ${VALID_TARGETS.join(', ')}`)
    }
    if (target !== 'all' && (!target_value || target_value.trim().length === 0)) {
      throw new AppError(400, ErrorCode.VALIDATION_ERROR, `target_value is required when target is "${target}"`)
    }

    // Resolve device tokens based on target
    let tokens: string[]

    if (target === 'all') {
      const rows = await fastify.db
        .select({ token: device_tokens.token })
        .from(device_tokens)
      tokens = rows.map((r) => r.token)
    } else {
      // First resolve matching user IDs, then their tokens
      let userIds: string[]

      if (target === 'role') {
        const rows = await fastify.db
          .select({ id: users.id })
          .from(users)
          .where(eq(users.role, target_value as UserRole))
        userIds = rows.map((r) => r.id)
      } else if (target === 'country') {
        const rows = await fastify.db
          .select({ id: users.id })
          .from(users)
          .where(eq(users.country, target_value!))
        userIds = rows.map((r) => r.id)
      } else {
        // city
        const rows = await fastify.db
          .select({ id: users.id })
          .from(users)
          .where(eq(users.city, target_value!))
        userIds = rows.map((r) => r.id)
      }

      if (userIds.length === 0) {
        return { attempted: 0 }
      }

      const tokenRows = await fastify.db
        .select({ token: device_tokens.token })
        .from(device_tokens)
        .where(inArray(device_tokens.user_id, userIds))
      tokens = tokenRows.map((r) => r.token)
    }

    if (tokens.length === 0) {
      appEvents.emit('admin.broadcast_push', {
        adminId:        request.user.id,
        adminRole:      request.user.role,
        target,
        targetValue:    target_value,
        attemptedCount: 0,
      })
      return { attempted: 0 }
    }

    const staleTokens = await sendPush(
      tokens,
      { title: title.trim(), body: body.trim(), data: pushData },
      fastify.log,
    )

    // Clean up stale tokens reported by Expo
    if (staleTokens.length > 0) {
      await fastify.db
        .delete(device_tokens)
        .where(inArray(device_tokens.token, staleTokens))
    }

    appEvents.emit('admin.broadcast_push', {
      adminId:        request.user.id,
      adminRole:      request.user.role,
      target,
      targetValue:    target_value,
      attemptedCount: tokens.length,
    })

    return { attempted: tokens.length }
  })
}

export default adminPush
