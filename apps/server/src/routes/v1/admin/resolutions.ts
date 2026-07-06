/**
 * Dispute-resolution collection routes (Issue-3 propose→sign queue):
 *   GET  /v1/admin/resolutions?status= — the signing queue (disputes.read).
 *   POST /v1/admin/resolutions/:id/reject — a key-holder returns a proposal
 *        to the mediator (disputes.execute). This is the multisig "reject"
 *        vote later; today it simply reopens the dispute for a new proposal.
 * The per-dispute propose / current-proposal routes live on admin/disputes.ts
 * (dispute-scoped); both share lib/disputes/resolution-store.ts.
 */
import type { FastifyPluginAsync } from 'fastify'
import { eq } from 'drizzle-orm'
import { dispute_resolutions } from '@tenda/shared/db/schema'
import { ErrorCode, MAX_DISPUTE_REASON_LENGTH } from '@tenda/shared'
import type {
  ApiError,
  DisputeResolution,
  PaginatedResponse,
  RejectResolutionBody,
  ResolutionQueueRow,
  ResolutionStatus,
} from '@tenda/shared'
import { clampLimit, clampOffset } from '@server/lib/pagination'
import { requirePermission } from '@server/lib/guards'
import { AppError } from '@server/lib/errors'
import { appEvents } from '@server/lib/events'
import {
  ACTIVE_RESOLUTION_STATUSES,
  getResolutionById,
  getResolutionQueue,
  toResolutionWire,
} from '@server/lib/disputes/resolution-store'

const RESOLUTION_STATUSES: readonly ResolutionStatus[] = ['pending', 'executing', 'confirmed', 'rejected']

function narrowStatus(v: unknown): ResolutionStatus | undefined {
  return RESOLUTION_STATUSES.find((s) => s === v)
}

const isActive = (s: ResolutionStatus): boolean =>
  (ACTIVE_RESOLUTION_STATUSES as readonly ResolutionStatus[]).includes(s)

const adminResolutions: FastifyPluginAsync = async (fastify) => {
  // GET /v1/admin/resolutions — signing queue, newest first. Defaults to the
  // actionable 'pending' state.
  fastify.get<{
    Querystring: { status?: string; limit?: number; offset?: number }
    Reply: PaginatedResponse<ResolutionQueueRow> | ApiError
  }>('/', { preHandler: [requirePermission('disputes.read')] }, async (request) => {
    const status = request.query.status === undefined ? 'pending' : narrowStatus(request.query.status)
    if (status === undefined) {
      throw new AppError(400, ErrorCode.VALIDATION_ERROR, `status must be one of: ${RESOLUTION_STATUSES.join(', ')}`)
    }
    const limit = clampLimit(Number(request.query.limit ?? 20))
    const offset = clampOffset(Number(request.query.offset ?? 0))
    const { rows, total } = await getResolutionQueue(fastify.db, status, limit, offset)
    return { data: rows, total, limit, offset }
  })

  // POST /v1/admin/resolutions/:id/reject — return an active proposal to the
  // mediator with a reason. Idempotency: only pending|executing can be rejected.
  fastify.post<{
    Params: { id: string }
    Body: RejectResolutionBody
    Reply: DisputeResolution | ApiError
  }>('/:id/reject', { preHandler: [requirePermission('disputes.execute')] }, async (request) => {
    const reason = typeof request.body?.reason === 'string' ? request.body.reason.trim() : ''
    if (reason.length === 0 || reason.length > MAX_DISPUTE_REASON_LENGTH) {
      throw new AppError(400, ErrorCode.VALIDATION_ERROR, `reason must be 1–${MAX_DISPUTE_REASON_LENGTH} characters`)
    }

    const existing = await getResolutionById(fastify.db, request.params.id)
    if (existing === undefined) throw new AppError(404, ErrorCode.RESOLUTION_NOT_FOUND, 'Resolution not found')
    if (!isActive(existing.status)) {
      throw new AppError(409, ErrorCode.RESOLUTION_NOT_ACTIVE, `resolution is ${existing.status}, not active`)
    }

    const [updated] = await fastify.db
      .update(dispute_resolutions)
      .set({ status: 'rejected', reject_reason: reason, rejected_by: request.user.id })
      .where(eq(dispute_resolutions.id, existing.id))
      .returning()

    appEvents.emit('admin.reject_resolution', {
      adminId: request.user.id,
      adminRole: request.user.role,
      disputeId: updated.dispute_id,
      resolutionId: updated.id,
      reason,
    })
    return toResolutionWire(updated)
  })
}

export default adminResolutions
