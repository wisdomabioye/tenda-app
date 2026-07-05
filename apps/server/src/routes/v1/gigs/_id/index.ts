/**
 * GET /v1/gigs/:id, public gig detail (cutover §3 rewrite): escrows ⨝
 * gig_details + creator/counterparty refs, proofs, dispute and reviews.
 * Read-only; transitions live under /v1/escrows/:id/*.
 *
 * Drafts are pre-publish staging rows: 404 to the public, but the CREATOR
 * must see them (my-gigs lists drafts; the Delete Draft CTA lives here),
 * so a draft hit runs the full authenticate (suspended accounts rejected
 * like everywhere else) and compares the caller.
 */
import { FastifyPluginAsync } from 'fastify'
import { eq, inArray } from 'drizzle-orm'
import { escrows, gig_details, users, escrow_proofs, disputes, reviews } from '@tenda/shared/db/schema'
import { ErrorCode } from '@tenda/shared'
import type { GigsContract, ApiError, UserRef } from '@tenda/shared'
import { AppError } from '@server/lib/errors'
import { canViewHidden } from '@server/lib/escrow-routes'
import { USER_COLS } from '@server/lib/users'

type GetRoute = GigsContract['get']

const iso = (d: Date | null): string | null => (d === null ? null : d.toISOString())

const gigById: FastifyPluginAsync = async (fastify) => {
  fastify.get<{
    Params: GetRoute['params']
    Reply: GetRoute['response'] | ApiError
  }>('/', async (request, reply) => {
    const { id } = request.params

    const [row] = await fastify.db
      .select()
      .from(escrows)
      .innerJoin(gig_details, eq(gig_details.escrow_id, escrows.id))
      .where(eq(escrows.id, id))
      .limit(1)
    if (row === undefined) {
      throw new AppError(404, ErrorCode.NOT_FOUND, 'Gig not found')
    }
    const escrow = row.escrows
    const details = row.gig_details

    // Private rows (pre-publish drafts; CO1 taken-down listings) must read
    // as 404 to anyone unauthorized, anonymous callers get the 404
    // directly (authenticate would 401 and leak that the id exists).
    // Authenticated callers go through the full authenticate (suspended
    // accounts rejected like everywhere else), then the ownership check:
    // drafts are creator-only; hidden listings stay visible to all parties
    // (the escrow may be mid-flight on-chain) and to admins.
    if (escrow.status === 'draft' || escrow.hidden) {
      if (request.headers.authorization === undefined) {
        throw new AppError(404, ErrorCode.NOT_FOUND, 'Gig not found')
      }
      await fastify.authenticate(request, reply)
      if (reply.sent) return reply
      const allowed =
        escrow.status === 'draft'
          ? request.user.id === escrow.creator_id
          : canViewHidden(escrow, request.user.id, request.user.role)
      if (!allowed) {
        throw new AppError(404, ErrorCode.NOT_FOUND, 'Gig not found')
      }
    }

    const userIds =
      escrow.counterparty_id === null
        ? [escrow.creator_id]
        : [escrow.creator_id, escrow.counterparty_id]

    const [userRows, proofs, disputeRows, gigReviews] = await Promise.all([
      fastify.db.select(USER_COLS).from(users).where(inArray(users.id, userIds)),
      fastify.db.select().from(escrow_proofs).where(eq(escrow_proofs.escrow_id, id)),
      fastify.db.select().from(disputes).where(eq(disputes.escrow_id, id)).limit(1),
      fastify.db.select().from(reviews).where(eq(reviews.escrow_id, id)),
    ])

    const userMap = new Map<string, UserRef>(userRows.map((u) => [u.id, u]))
    const creator = userMap.get(escrow.creator_id)
    if (creator === undefined) {
      throw new AppError(500, ErrorCode.INTERNAL_ERROR, 'escrow creator row missing')
    }
    const counterparty =
      escrow.counterparty_id === null ? null : (userMap.get(escrow.counterparty_id) ?? null)

    return reply.send({
      escrow_id: escrow.id,
      chain_id: escrow.chain_id,
      asset: escrow.asset,
      amount_raw: escrow.amount_raw,
      is_seeker: escrow.is_seeker,
      status: escrow.status,
      accept_deadline: iso(escrow.accept_deadline),
      created_at: escrow.created_at.toISOString(),
      title: details.title,
      description: details.description,
      category: details.category as GetRoute['response']['category'],
      country: details.country,
      city: details.city,
      latitude: details.latitude,
      longitude: details.longitude,
      remote: details.remote,
      cross_border: details.cross_border,
      creator,
      completion_duration_seconds: escrow.completion_duration_seconds,
      completion_deadline: iso(escrow.completion_deadline),
      submitted_at: iso(escrow.submitted_at),
      approval_deadline: iso(escrow.approval_deadline),
      dispute_bond_raw: escrow.dispute_bond_raw,
      assigned_counterparty_id: escrow.assigned_counterparty_id,
      counterparty,
      proofs,
      dispute: disputeRows[0] ?? null,
      reviews: gigReviews,
    })
  })
}

export default gigById
