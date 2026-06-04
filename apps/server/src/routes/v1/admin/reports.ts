import { FastifyPluginAsync } from 'fastify'
import { eq, and, desc, sql } from 'drizzle-orm'
import { reports } from '@tenda/shared/db/schema'
import {
  ErrorCode, MAX_PAGINATION_LIMIT, REPORT_STATUSES, REPORT_CONTENT_TYPES,
} from '@tenda/shared'
import type { ApiError, ReportStatus, ReportContentType } from '@tenda/shared'
import { requireRole } from '@server/lib/guards'
import { AppError } from '@server/lib/errors'
import { ensureTxUpdated } from '@server/lib/db'
import { appEvents } from '@server/lib/events'

// All report routes: moderator, support, super_admin (role matrix: "Action reports")
const REPORT_ROLES = ['super_admin'] as const

const adminReports: FastifyPluginAsync = async (fastify) => {
  // GET /v1/admin/reports
  fastify.get<{
    Querystring: { status?: ReportStatus; content_type?: string; limit?: number; offset?: number }
  }>('/', { 
    preHandler: [requireRole(...REPORT_ROLES)] 
  }, async (request) => {
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

  // PATCH /v1/admin/reports/:id — action a report. Content takedown has no
  // v2 'hidden' flag: act on the OWNER (suspend via /admin/users) or the
  // listing's lifecycle (dispute/resolve) instead.
  fastify.patch<{
    Params: { id: string }
    Body:  { status: ReportStatus; admin_note?: string }
    Reply: unknown | ApiError
  }>('/:id', { 
    preHandler: [requireRole(...REPORT_ROLES)] 
  }, async (request) => {
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

    appEvents.emit('admin.action_report', {
      adminId:     request.user.id,
      adminRole:   request.user.role,
      reportId:    request.params.id,
      newStatus:   status,
      adminNote:   admin_note,
    })

    return result
  })
}

export default adminReports
