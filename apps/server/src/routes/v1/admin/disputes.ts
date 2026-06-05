/**
 * Admin dispute queue (cutover §2 rewrite): v2 has ONE disputes table
 * keyed on escrow_id — the legacy gig/exchange split, mediation threads
 * and HTTP resolve are gone. Resolution itself goes through
 * POST /v1/escrows/:id/resolve (on-chain multisig path, admin-gated
 * there); this surface is read-only triage.
 */
import { FastifyPluginAsync } from 'fastify'
import { eq, and, desc, isNull, isNotNull, sql, type SQL } from 'drizzle-orm'
import { disputes, escrows, gig_details, users } from '@tenda/shared/db/schema'
import { ErrorCode, MAX_PAGINATION_LIMIT } from '@tenda/shared'
import type { ApiError, DisputeSummary, PaginatedResponse } from '@tenda/shared'
import { requirePermission } from '@server/lib/guards'
import { AppError } from '@server/lib/errors'


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
    resolved_at: iso(row.resolved_at),
    raised_at: iso(row.raised_at),
  })

  // GET /v1/admin/disputes — triage queue, newest first.
  fastify.get<{
    Querystring: { status?: 'open' | 'resolved'; kind?: 'gig' | 'exchange'; limit?: number; offset?: number }
    Reply: PaginatedResponse<DisputeSummary> | ApiError
  }>('/', { preHandler: [requirePermission('disputes.read')] }, async (request) => {
    const { status, kind, limit = 20, offset = 0 } = request.query
    const safeLimit = Math.min(Number(limit), MAX_PAGINATION_LIMIT)
    const safeOffset = Number(offset)

    const conditions: SQL[] = []
    // 'open' also requires the on-chain dispute to be live: the triage row
    // is upserted at request time, so an unconfirmed/abandoned dispute
    // attempt must not surface in the actionable queue.
    if (status === 'open') {
      conditions.push(isNull(disputes.resolved_at), eq(escrows.status, 'disputed'))
    }
    if (status === 'resolved') conditions.push(isNotNull(disputes.resolved_at))
    if (kind === 'gig' || kind === 'exchange') conditions.push(eq(escrows.kind, kind))
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

  // GET /v1/admin/disputes/:id — single dispute detail.
  fastify.get<{
    Params: { id: string }
    Reply: DisputeSummary | ApiError
  }>('/:id', { preHandler: [requirePermission('disputes.read')] }, async (request) => {
    const [row] = await summaryQuery().where(eq(disputes.id, request.params.id)).limit(1)
    if (row === undefined) throw new AppError(404, ErrorCode.NOT_FOUND, 'Dispute not found')
    return toSummary(row)
  })
}

export default adminDisputes
