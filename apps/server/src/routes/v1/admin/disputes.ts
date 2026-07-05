/**
 * Admin dispute queue (cutover §2 rewrite): v2 has ONE disputes table
 * keyed on escrow_id, the legacy gig/exchange split, mediation threads
 * and HTTP resolve are gone. Resolution itself goes through
 * POST /v1/escrows/:id/resolve (on-chain multisig path, admin-gated
 * there); this surface is read-only triage.
 */
import { FastifyPluginAsync } from 'fastify'
import { clampLimit, clampOffset } from '@server/lib/pagination'
import { eq, and, or, desc, isNull, isNotNull, sql, type SQL } from 'drizzle-orm'
import { disputes, escrows, gig_details, users } from '@tenda/shared/db/schema'
import { ErrorCode } from '@tenda/shared'
import type { ApiError, DisputeSummary, PaginatedResponse } from '@tenda/shared'
import { requirePermission } from '@server/lib/guards'
import { AppError } from '@server/lib/errors'
import { appEvents } from '@server/lib/events'


const iso = (d: Date | null): string | null => (d === null ? null : d.toISOString())

const adminDisputes: FastifyPluginAsync = async (fastify) => {
  const summaryCols = {
    dispute_id: disputes.id,
    escrow_id: disputes.escrow_id,
    kind: escrows.kind,
    subject_title: gig_details.title,
    raised_by_id: disputes.raised_by,
    raised_by_first_name: users.first_name,
    raised_by_last_name: users.last_name,
    reason: disputes.reason,
    assigned_to_id: disputes.assigned_to,
    assigned_at: disputes.assigned_at,
    winner: disputes.winner,
    resolved_by_id: disputes.resolved_by,
    resolved_at: disputes.resolved_at,
    raised_at: disputes.created_at,
  }

  function summaryQuery() {
    return fastify.db
      .select(summaryCols)
      .from(disputes)
      .innerJoin(escrows, eq(disputes.escrow_id, escrows.id))
      .leftJoin(gig_details, eq(gig_details.escrow_id, escrows.id))
      .innerJoin(users, eq(users.id, disputes.raised_by))
      .$dynamic()
  }

  type SummaryRow = Awaited<ReturnType<typeof summaryQuery>>[number]

  const toSummary = (row: SummaryRow): DisputeSummary => ({
    ...row,
    assigned_at: iso(row.assigned_at),
    resolved_at: iso(row.resolved_at),
    raised_at: iso(row.raised_at),
  })

  // GET /v1/admin/disputes, triage queue, newest first.
  fastify.get<{
    Querystring: {
      status?: 'open' | 'resolved'
      kind?: 'gig' | 'exchange'
      assigned?: 'me' | 'none'
      limit?: number
      offset?: number
    }
    Reply: PaginatedResponse<DisputeSummary> | ApiError
  }>('/', { preHandler: [requirePermission('disputes.read')] }, async (request) => {
    const { status, kind, assigned, limit = 20, offset = 0 } = request.query
    const safeLimit = clampLimit(Number(limit))
    const safeOffset = clampOffset(Number(offset))

    const conditions: SQL[] = []
    // 'open' also requires the on-chain dispute to be live: the triage row
    // is upserted at request time, so an unconfirmed/abandoned dispute
    // attempt must not surface in the actionable queue.
    if (status === 'open') {
      conditions.push(isNull(disputes.resolved_at), eq(escrows.status, 'disputed'))
    }
    if (status === 'resolved') conditions.push(isNotNull(disputes.resolved_at))
    if (kind === 'gig' || kind === 'exchange') conditions.push(eq(escrows.kind, kind))
    // Claim-pool views (CO7): my caseload vs the unclaimed pool.
    if (assigned === 'me') conditions.push(eq(disputes.assigned_to, request.user.id))
    if (assigned === 'none') conditions.push(isNull(disputes.assigned_to))
    const where = conditions.length > 0 ? and(...conditions) : undefined

    const [rows, countResult] = await Promise.all([
      summaryQuery().where(where).orderBy(desc(disputes.created_at)).limit(safeLimit).offset(safeOffset),
      fastify.db
        .select({ count: sql<number>`count(*)::int` })
        .from(disputes)
        .innerJoin(escrows, eq(disputes.escrow_id, escrows.id))
        .where(where),
    ])

    return {
      data: rows.map(toSummary),
      total: countResult[0].count,
      limit: safeLimit,
      offset: safeOffset,
    }
  })

  // GET /v1/admin/disputes/:id, single dispute detail.
  fastify.get<{
    Params: { id: string }
    Reply: DisputeSummary | ApiError
  }>('/:id', { preHandler: [requirePermission('disputes.read')] }, async (request) => {
    const [row] = await summaryQuery().where(eq(disputes.id, request.params.id)).limit(1)
    if (row === undefined) throw new AppError(404, ErrorCode.NOT_FOUND, 'Dispute not found')
    return toSummary(row)
  })

  // POST /v1/admin/disputes/:id/claim, take the dispute from the open
  // pool (CO7). Atomic: the WHERE clause loses the race instead of
  // double-assigning; re-claiming your own dispute is a no-op 200.
  fastify.post<{
    Params: { id: string }
    Reply: { id: string; assigned_to_id: string } | ApiError
  }>('/:id/claim', { preHandler: [requirePermission('disputes.mediate')] }, async (request) => {
    const me = request.user.id
    const [claimed] = await fastify.db
      .update(disputes)
      .set({ assigned_to: me, assigned_at: new Date() })
      .where(
        and(
          eq(disputes.id, request.params.id),
          isNull(disputes.resolved_at),
          or(isNull(disputes.assigned_to), eq(disputes.assigned_to, me)),
        ),
      )
      .returning({ id: disputes.id })
    if (claimed !== undefined) {
      appEvents.emit('admin.claim_dispute', {
        adminId: me,
        adminRole: request.user.role,
        disputeId: claimed.id,
      })
      return { id: claimed.id, assigned_to_id: me }
    }

    // Distinguish the three failure shapes for a useful client error.
    const [row] = await fastify.db
      .select({ assigned_to: disputes.assigned_to, resolved_at: disputes.resolved_at })
      .from(disputes)
      .where(eq(disputes.id, request.params.id))
      .limit(1)
    if (row === undefined) throw new AppError(404, ErrorCode.NOT_FOUND, 'Dispute not found')
    if (row.resolved_at !== null) {
      throw new AppError(409, ErrorCode.DISPUTE_RESOLVED, 'Dispute already resolved')
    }
    throw new AppError(409, ErrorCode.DISPUTE_ALREADY_CLAIMED, 'Dispute already claimed by another mediator')
  })

  // POST /v1/admin/disputes/:id/release, return the dispute to the open
  // pool. Claimer-only; super_admin can force-release a colleague's claim.
  fastify.post<{
    Params: { id: string }
    Reply: { id: string; assigned_to_id: null } | ApiError
  }>('/:id/release', { preHandler: [requirePermission('disputes.mediate')] }, async (request) => {
    const me = request.user.id
    const [row] = await fastify.db
      .select({ id: disputes.id, assigned_to: disputes.assigned_to })
      .from(disputes)
      .where(eq(disputes.id, request.params.id))
      .limit(1)
    if (row === undefined) throw new AppError(404, ErrorCode.NOT_FOUND, 'Dispute not found')
    if (row.assigned_to === null) return { id: row.id, assigned_to_id: null } // idempotent
    if (row.assigned_to !== me && request.user.role !== 'super_admin') {
      throw new AppError(403, ErrorCode.FORBIDDEN, 'Only the claiming mediator (or a super_admin) can release')
    }

    await fastify.db
      .update(disputes)
      .set({ assigned_to: null, assigned_at: null })
      .where(eq(disputes.id, row.id))
    appEvents.emit('admin.release_dispute', {
      adminId: me,
      adminRole: request.user.role,
      disputeId: row.id,
      previousAssignee: row.assigned_to,
    })
    return { id: row.id, assigned_to_id: null }
  })
}

export default adminDisputes
