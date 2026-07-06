/**
 * Admin escrow oversight (cutover §2): replaces the legacy admin/gigs +
 * admin/exchange split with one kind-agnostic listing + detail, plus the
 * CO1 takedown toggle (PATCH /:id/hidden, escrows.takedown). Other admin
 * intervention happens through the dispute flow (/v1/escrows/:id/resolve),
 * user suspension, or Stage-6 moderation overrides.
 */
import { FastifyPluginAsync } from 'fastify'
import { clampLimit, clampOffset } from '@server/lib/pagination'
import { eq, and, desc, sql, type SQL } from 'drizzle-orm'
import { escrows, gig_details, exchange_details, users } from '@tenda/shared/db/schema'
import { ErrorCode, GIG_CATEGORIES } from '@tenda/shared'
import type {
  AdminEscrowDossier,
  AdminEscrowListQuery,
  AdminEscrowRow,
  ApiError,
  GigCategory,
  PaginatedResponse,
} from '@tenda/shared'
import { escrowStatusEnum } from '@tenda/shared/db/schema/escrow'
import { requirePermission } from '@server/lib/guards'
import { AppError } from '@server/lib/errors'
import { appEvents } from '@server/lib/events'
import { buildEscrowDossier } from '@server/lib/escrow/dossier'


const adminEscrows: FastifyPluginAsync = async (fastify) => {
  const rowCols = {
    id: escrows.id,
    kind: escrows.kind,
    status: escrows.status,
    hidden: escrows.hidden,
    chain_id: escrows.chain_id,
    asset: escrows.asset,
    amount_raw: escrows.amount_raw,
    title: gig_details.title,
    fiat_currency: exchange_details.fiat_currency,
    creator_id: escrows.creator_id,
    counterparty_id: escrows.counterparty_id,
    accept_deadline: escrows.accept_deadline,
    created_at: escrows.created_at,
    country: gig_details.country,
    city: gig_details.city,
    creator_first_name: users.first_name,
    creator_last_name: users.last_name,
  }

  function rowQuery() {
    return fastify.db
      .select(rowCols)
      .from(escrows)
      .leftJoin(gig_details, eq(gig_details.escrow_id, escrows.id))
      .leftJoin(exchange_details, eq(exchange_details.escrow_id, escrows.id))
      .innerJoin(users, eq(users.id, escrows.creator_id))
      .$dynamic()
  }

  type Row = Awaited<ReturnType<typeof rowQuery>>[number]

  const toRow = (row: Row): AdminEscrowRow => ({
    ...row,
    accept_deadline: row.accept_deadline === null ? null : row.accept_deadline.toISOString(),
    created_at: row.created_at.toISOString(),
  })

  // GET /v1/admin/escrows, filterable listing across both kinds.
  fastify.get<{
    Querystring: AdminEscrowListQuery
    Reply: PaginatedResponse<AdminEscrowRow> | ApiError
  }>('/', { preHandler: [requirePermission('escrows.read')] }, async (request) => {
    const { kind, status, chain_id, category, country, creator_id, limit = 20, offset = 0 } =
      request.query
    const safeLimit = clampLimit(Number(limit))
    const safeOffset = clampOffset(Number(offset))

    const conditions: SQL[] = []
    if (kind === 'gig' || kind === 'exchange') conditions.push(eq(escrows.kind, kind))
    if (status !== undefined) {
      if (!escrowStatusEnum.enumValues.includes(status)) {
        throw new AppError(
          400,
          ErrorCode.VALIDATION_ERROR,
          `status must be one of: ${escrowStatusEnum.enumValues.join(', ')}`,
        )
      }
      conditions.push(eq(escrows.status, status))
    }
    if (chain_id !== undefined) conditions.push(eq(escrows.chain_id, chain_id))
    if (category !== undefined) {
      if (!GIG_CATEGORIES.includes(category as GigCategory)) {
        throw new AppError(
          400,
          ErrorCode.VALIDATION_ERROR,
          `category must be one of: ${GIG_CATEGORIES.join(', ')}`,
        )
      }
      conditions.push(eq(gig_details.category, category))
    }
    if (country !== undefined) conditions.push(eq(gig_details.country, country))
    if (creator_id !== undefined) conditions.push(eq(escrows.creator_id, creator_id))
    const where = conditions.length > 0 ? and(...conditions) : undefined

    const [rows, countResult] = await Promise.all([
      rowQuery().where(where).orderBy(desc(escrows.created_at)).limit(safeLimit).offset(safeOffset),
      fastify.db
        .select({ count: sql<number>`count(*)::int` })
        .from(escrows)
        .leftJoin(gig_details, eq(gig_details.escrow_id, escrows.id))
        .where(where),
    ])

    return {
      data: rows.map(toRow),
      total: countResult[0].count,
      limit: safeLimit,
      offset: safeOffset,
    }
  })

  // GET /v1/admin/escrows/:id, full row for triage (incl. drafts).
  fastify.get<{
    Params: { id: string }
    Reply: AdminEscrowRow | ApiError
  }>('/:id', { preHandler: [requirePermission('escrows.read')] }, async (request) => {
    const [row] = await rowQuery().where(eq(escrows.id, request.params.id)).limit(1)
    if (row === undefined) throw new AppError(404, ErrorCode.NOT_FOUND, 'Escrow not found')
    return toRow(row)
  })

  // GET /v1/admin/escrows/:id/dossier, full mediation context (parties,
  // amounts, kind-specific details, proofs, tx timeline) behind a dispute.
  fastify.get<{
    Params: { id: string }
    Reply: AdminEscrowDossier | ApiError
  }>('/:id/dossier', { preHandler: [requirePermission('escrows.read')] }, async (request) => {
    const dossier = await buildEscrowDossier(fastify.db, request.params.id)
    if (dossier === null) throw new AppError(404, ErrorCode.NOT_FOUND, 'Escrow not found')
    return dossier
  })

  // PATCH /v1/admin/escrows/:id/hidden, CO1 takedown toggle. Hides the
  // listing from the public browse/detail surfaces; the escrow itself stays
  // fully operable by its parties (funds may be locked on-chain), so this
  // never touches status or the state machine.
  fastify.patch<{
    Params: { id: string }
    Body: { hidden: boolean }
    Reply: { id: string; hidden: boolean } | ApiError
  }>('/:id/hidden', { preHandler: [requirePermission('escrows.takedown')] }, async (request) => {
    const hidden = request.body?.hidden
    if (typeof hidden !== 'boolean') {
      throw new AppError(400, ErrorCode.VALIDATION_ERROR, 'hidden must be a boolean')
    }

    const [updated] = await fastify.db
      .update(escrows)
      .set({ hidden, updated_at: new Date() })
      .where(eq(escrows.id, request.params.id))
      .returning({ id: escrows.id, hidden: escrows.hidden })
    if (updated === undefined) throw new AppError(404, ErrorCode.NOT_FOUND, 'Escrow not found')

    appEvents.emit('admin.set_escrow_hidden', {
      adminId: request.user.id,
      adminRole: request.user.role,
      escrowId: updated.id,
      hidden: updated.hidden,
    })

    return updated
  })
}

export default adminEscrows
