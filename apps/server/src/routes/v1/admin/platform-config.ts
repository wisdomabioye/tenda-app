import { FastifyPluginAsync } from 'fastify'
import { eq } from 'drizzle-orm'
import { platform_config } from '@tenda/shared/db/schema'
import { ErrorCode } from '@tenda/shared'
import { requireRole } from '@server/lib/guards'
import { AppError } from '@server/lib/errors'
import { ensureTxUpdated } from '@server/lib/db'
import { invalidatePlatformConfigCache } from '@server/lib/platform'
import { appEvents } from '@server/lib/events'
import type { ApiError } from '@tenda/shared'

const adminPlatformConfig: FastifyPluginAsync = async (fastify) => {
  // GET /v1/admin/platform-config — super_admin only
  fastify.get('/', { 
    preHandler: [requireRole('super_admin')] 
  }, async () => {
    const [row] = await fastify.db.select().from(platform_config).limit(1)
    if (!row) throw new AppError(404, ErrorCode.INTERNAL_ERROR, 'Platform config not found — seed the database first')
    return row
  })

  // PATCH /v1/admin/platform-config
  fastify.patch<{
    Body:  { fee_bps?: number; seeker_fee_bps?: number; grace_period_seconds?: number }
    Reply: unknown | ApiError
  }>('/', { 
    preHandler: [requireRole('super_admin')] 
  }, async (request) => {
    const { fee_bps, seeker_fee_bps, grace_period_seconds } = request.body

    if (fee_bps !== undefined && (fee_bps < 0 || fee_bps > 10_000 || !Number.isInteger(fee_bps))) {
      throw new AppError(400, ErrorCode.VALIDATION_ERROR, 'fee_bps must be an integer between 0 and 10000')
    }

    if (seeker_fee_bps !== undefined && (seeker_fee_bps < 0 || seeker_fee_bps > 10_000 || !Number.isInteger(seeker_fee_bps))) {
      throw new AppError(400, ErrorCode.VALIDATION_ERROR, 'seeker_fee_bps must be an integer between 0 and 10000')
    }

    const MAX_GRACE_PERIOD_SECONDS = 30 * 24 * 60 * 60
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
    if (fee_bps              !== undefined) updates.fee_bps              = fee_bps
    if (seeker_fee_bps       !== undefined) updates.seeker_fee_bps       = seeker_fee_bps
    if (grace_period_seconds !== undefined) updates.grace_period_seconds = grace_period_seconds

    const [updated] = await fastify.db
      .update(platform_config)
      .set(updates)
      .where(eq(platform_config.id, 1))
      .returning()

    const result = ensureTxUpdated(updated, 'Platform config not found — seed the database first')

    invalidatePlatformConfigCache()

    const changes: { fee_bps?: number; seeker_fee_bps?: number; grace_period_seconds?: number } = {
      ...(fee_bps              !== undefined && { fee_bps }),
      ...(seeker_fee_bps       !== undefined && { seeker_fee_bps }),
      ...(grace_period_seconds !== undefined && { grace_period_seconds }),
    }
    appEvents.emit('admin.update_platform_config', {
      adminId:     request.user.id,
      adminRole:   request.user.role,
      changes,
    })

    return result
  })
}

export default adminPlatformConfig
