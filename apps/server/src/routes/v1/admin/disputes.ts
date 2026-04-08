import { FastifyPluginAsync } from 'fastify'
import { eq, and } from 'drizzle-orm'
import {
  dispute_threads,
  users,
  gigs,
  disputes,
  gig_transactions,
  exchange_offers,
  exchange_disputes,
  exchange_transactions,
} from '@tenda/shared/db/schema'
import { ErrorCode, MAX_PAGINATION_LIMIT, computePlatformFee } from '@tenda/shared'
import { requireRole } from '@server/lib/guards'
import { AppError } from '@server/lib/errors'
import { appEvents } from '@server/lib/events'
import { verifyAndDecodeResolveDispute } from '@server/lib/solana'
import type { DisputeWinner, ExchangeDisputeWinner, ApiError } from '@tenda/shared'
import {
  parseDisputeType,
  listOpenDisputes,
  fetchGigDispute,
  fetchExchangeDispute,
  openDisputeThread,
  getThreadForDispute,
  getThreadMessages,
  postThreadMessage,
  markThreadRead,
} from '@server/lib/disputes'
import { ensureGigExists, ensureGigStatus, ensureTxUpdated } from '@server/lib/gigs'
import {
  ensureOfferExists, ensureOfferStatus, ensureOfferTxUpdated, buildOfferDetail,
} from '@server/lib/exchange'
import { isPostgresUniqueViolation } from '@server/lib/db'
import { getPlatformConfig } from '@server/lib/platform'

// Role guards for dispute routes (per role matrix)
const DISPUTE_VIEW_ROLES   = ['support', 'dispute_resolver', 'super_admin'] as const
const DISPUTE_RESOLVE_ROLES = ['dispute_resolver', 'super_admin'] as const
const DISPUTE_ASSIGN_ROLES  = ['super_admin'] as const

const adminDisputes: FastifyPluginAsync = async (fastify) => {
  // ── GET /v1/admin/disputes — list all open disputes (gig + exchange UNION) ──
  // Fix #8/#31: merges both dispute tables with a normalised column set.
  fastify.get<{
    Querystring: { limit?: number; offset?: number }
    Reply: { data: unknown[]; total: number; limit: number; offset: number } | ApiError
  }>('/', {
    preHandler: [requireRole(...DISPUTE_VIEW_ROLES)],
  }, async (request) => {
    const { limit = 20, offset = 0 } = request.query
    const safeLimit  = Math.min(Number(limit), MAX_PAGINATION_LIMIT)
    const safeOffset = Number(offset)

    return listOpenDisputes(fastify.db, safeLimit, safeOffset)
  })

  // ── GET /v1/admin/disputes/:type/:id — dispute detail ──────────────────────
  fastify.get<{
    Params: { type: string; id: string }
    Reply: unknown | ApiError
  }>('/:type/:id', {
    preHandler: [requireRole(...DISPUTE_VIEW_ROLES)],
  }, async (request) => {
    const type = parseDisputeType(request.params.type)
    const { id } = request.params

    if (type === 'gig') return fetchGigDispute(fastify.db, id)
    return fetchExchangeDispute(fastify.db, id)
  })

  // ── POST /v1/admin/disputes/:type/:id/thread — open mediation thread ───────
  // Idempotent: returns existing thread without error (Fix #24).
  fastify.post<{
    Params: { type: string; id: string }
    Reply: { thread: unknown; created: boolean } | ApiError
  }>('/:type/:id/thread', {
    preHandler: [requireRole(...DISPUTE_VIEW_ROLES)],
  }, async (request) => {
    const type = parseDisputeType(request.params.type)
    const { id } = request.params

    // Verify dispute exists (throws 404 if not) so FK violation never reaches DB.
    if (type === 'gig') await fetchGigDispute(fastify.db, id)
    else                await fetchExchangeDispute(fastify.db, id)

    const opts = type === 'gig'
      ? { gigDisputeId: id }
      : { exchangeDisputeId: id }

    const { thread, created } = await openDisputeThread(fastify.db, opts)

    if (created) {
      appEvents.emit('admin.open_dispute_thread', {
        adminId:      request.user.id,
        adminWallet:  request.user.wallet_address,
        adminRole:    request.user.role,
        disputeId:    id,
        disputeType:  type,
      })
    }

    return { thread, created }
  })

  // ── GET /v1/admin/disputes/:type/:id/thread — paginated messages ───────────
  fastify.get<{
    Params: { type: string; id: string }
    Querystring: { limit?: number; offset?: number }
    Reply: unknown | ApiError
  }>('/:type/:id/thread', {
    preHandler: [requireRole(...DISPUTE_VIEW_ROLES)],
  }, async (request) => {
    const type = parseDisputeType(request.params.type)
    const { id } = request.params
    const { limit, offset } = request.query

    const opts = type === 'gig'
      ? { gigDisputeId: id }
      : { exchangeDisputeId: id }

    const thread = await getThreadForDispute(fastify.db, opts)
    if (!thread) throw new AppError(404, ErrorCode.NOT_FOUND, 'No thread found for this dispute — open one first')

    await markThreadRead(fastify.db, thread.id, 'admin')

    return getThreadMessages(fastify.db, thread.id, { limit, offset })
  })

  // ── POST /v1/admin/disputes/:type/:id/thread/messages — admin sends message ─
  // Rate-limited: 60 messages per hour per admin (Fix #48).
  fastify.post<{
    Params: { type: string; id: string }
    Body:   { body: string }
    Reply: unknown | ApiError
  }>('/:type/:id/thread/messages', {
    preHandler: [requireRole(...DISPUTE_VIEW_ROLES)],
    config:     { rateLimit: { max: 60, timeWindow: '1 hour' } },
  }, async (request) => {
    const type = parseDisputeType(request.params.type)
    const { id } = request.params
    const { body } = request.body

    if (!body || body.trim().length === 0) {
      throw new AppError(400, ErrorCode.VALIDATION_ERROR, 'body is required')
    }
    if (body.trim().length > 2000) {
      throw new AppError(400, ErrorCode.VALIDATION_ERROR, 'body must be at most 2000 characters')
    }

    const opts = type === 'gig'
      ? { gigDisputeId: id }
      : { exchangeDisputeId: id }

    const thread = await getThreadForDispute(fastify.db, opts)
    if (!thread) throw new AppError(404, ErrorCode.NOT_FOUND, 'No thread found for this dispute — open one first')

    const msg = await postThreadMessage(fastify.db, thread.id, request.user.id, 'admin', body)
    await markThreadRead(fastify.db, thread.id, 'admin')

    return msg
  })

  // ── PATCH /v1/admin/disputes/:type/:id/thread/assign — assign resolver ─────
  fastify.patch<{
    Params: { type: string; id: string }
    Body:   { assigned_to_id: string | null }
    Reply: { id: string; assigned_to_id: string | null } | ApiError
  }>('/:type/:id/thread/assign', {
    preHandler: [requireRole(...DISPUTE_ASSIGN_ROLES)],
  }, async (request) => {
    const type = parseDisputeType(request.params.type)
    const { id } = request.params
    const { assigned_to_id } = request.body

    const opts = type === 'gig'
      ? { gigDisputeId: id }
      : { exchangeDisputeId: id }

    const thread = await getThreadForDispute(fastify.db, opts)
    if (!thread) throw new AppError(404, ErrorCode.NOT_FOUND, 'No thread found for this dispute — open one first')

    // When assigning (not clearing), verify the target user has an appropriate role
    if (assigned_to_id !== null) {
      const [target] = await fastify.db
        .select({ id: users.id, role: users.role, wallet_address: users.wallet_address })
        .from(users)
        .where(eq(users.id, assigned_to_id))
        .limit(1)
      if (!target) throw new AppError(404, ErrorCode.USER_NOT_FOUND, 'User not found')
      if (target.role !== 'dispute_resolver' && target.role !== 'super_admin') {
        throw new AppError(400, ErrorCode.VALIDATION_ERROR, 'Can only assign to dispute_resolver or super_admin')
      }

      appEvents.emit('admin.assign_dispute', {
        adminId:          request.user.id,
        adminWallet:      request.user.wallet_address,
        adminRole:        request.user.role,
        disputeId:        id,
        assignedToId:     assigned_to_id,
        assignedToWallet: target.wallet_address,
      })
    }

    const [updated] = await fastify.db
      .update(dispute_threads)
      .set({ assigned_to_id })
      .where(eq(dispute_threads.id, thread.id))
      .returning({ id: dispute_threads.id, assigned_to_id: dispute_threads.assigned_to_id })

    return updated!
  })

  // ── POST /v1/admin/disputes/:type/:id/resolve — resolve dispute ────────────
  // Winner is derived from the on-chain resolve_dispute instruction (Fix #4).
  // :type = 'gig' | 'exchange'; :id = dispute id (disputes.id or exchange_disputes.id).
  fastify.post<{
    Params: { type: string; id: string }
    Body:   { signature: string }
    Reply: unknown | ApiError
  }>('/:type/:id/resolve', {
    preHandler: [requireRole(...DISPUTE_RESOLVE_ROLES)],
  }, async (request) => {
    const type = parseDisputeType(request.params.type)
    const { id } = request.params
    const { signature } = request.body

    if (!signature) {
      throw new AppError(400, ErrorCode.VALIDATION_ERROR, 'signature is required')
    }

    if (type === 'gig') {
      const dispute = await fetchGigDispute(fastify.db, id)
      if (dispute.resolved_at) throw new AppError(409, ErrorCode.GIG_WRONG_STATUS, 'Dispute already resolved')

      const gig = await ensureGigExists(fastify.db, dispute.gig_id)
      ensureGigStatus(gig, 'disputed')

      const winner = await verifyAndDecodeResolveDispute(signature, 'gig') as DisputeWinner

      // Use the fee locked at escrow creation, not the current config — they diverge if fees change.
      const [createEscrowTx] = await fastify.db
        .select({ platform_fee_lamports: gig_transactions.platform_fee_lamports })
        .from(gig_transactions)
        .where(and(eq(gig_transactions.gig_id, gig.id), eq(gig_transactions.type, 'create_escrow')))
        .limit(1)

      const platform_fee_lamports = createEscrowTx?.platform_fee_lamports
        ?? computePlatformFee(BigInt(gig.payment_lamports), (await getPlatformConfig(fastify.db)).fee_bps)

      const resolverWallet = request.user.wallet_address
      const now                = new Date()

      let txResult
      try {
        txResult = await fastify.db.transaction(async (tx) => {
          const [updatedGig] = await tx
            .update(gigs)
            .set({ status: 'resolved', updated_at: now })
            .where(and(eq(gigs.id, gig.id), eq(gigs.status, 'disputed')))
            .returning()
          if (!updatedGig) return null

          await tx
            .update(disputes)
            .set({ winner, resolver_wallet_address: resolverWallet, resolved_at: now })
            .where(eq(disputes.id, id))

          await tx.insert(gig_transactions).values({
            gig_id:               gig.id,
            type:                 'dispute_resolved',
            signature,
            amount_lamports:      gig.payment_lamports,
            platform_fee_lamports,
          })

          return updatedGig
        })
      } catch (err) {
        if (isPostgresUniqueViolation(err)) {
          throw new AppError(409, ErrorCode.DUPLICATE_SIGNATURE, 'This transaction signature has already been recorded')
        }
        throw err
      }

      const updated = ensureTxUpdated(txResult, 'Gig status changed — it may have already been resolved')

      appEvents.emit('admin.resolve_dispute', {
        adminId: request.user.id, adminWallet: request.user.wallet_address, adminRole: request.user.role,
        disputeId: id, disputeType: 'gig', winner, signature,
      })
      appEvents.emit('gig.resolved', {
        gigId: updated.id, posterId: updated.poster_id, workerId: updated.worker_id!,
        winner, title: updated.title,
      })

      return updated
    }

    // ── exchange ──────────────────────────────────────────────────────────────
    const dispute = await fetchExchangeDispute(fastify.db, id)
    if (dispute.resolved_at) throw new AppError(409, ErrorCode.GIG_WRONG_STATUS, 'Dispute already resolved')

    const offer = await ensureOfferExists(fastify.db, dispute.offer_id)
    ensureOfferStatus(offer, 'disputed')

    const winner = await verifyAndDecodeResolveDispute(signature, 'exchange') as ExchangeDisputeWinner

    // Use the fee locked at escrow creation — recomputing here would give the wrong value
    // if the platform fee config changed between create_escrow and dispute resolution.
    const [escrowTx] = await fastify.db
      .select({ platform_fee_lamports: exchange_transactions.platform_fee_lamports })
      .from(exchange_transactions)
      .where(and(eq(exchange_transactions.offer_id, offer.id), eq(exchange_transactions.type, 'create_escrow')))
      .limit(1)

    const platform_fee_lamports = escrowTx?.platform_fee_lamports
      ?? computePlatformFee(BigInt(offer.lamports_amount), (await getPlatformConfig(fastify.db)).fee_bps)
    const now = new Date()

    let txResult
    try {
      txResult = await fastify.db.transaction(async (tx) => {
        const [updatedOffer] = await tx
          .update(exchange_offers)
          .set({ status: 'resolved', updated_at: now })
          .where(and(eq(exchange_offers.id, offer.id), eq(exchange_offers.status, 'disputed')))
          .returning()
        if (!updatedOffer) return null

        await tx
          .update(exchange_disputes)
          .set({ winner, resolver_wallet_address: request.user.wallet_address, resolved_at: now })
          .where(eq(exchange_disputes.id, id))

        await tx.insert(exchange_transactions).values({
          offer_id: offer.id, type: 'dispute_resolved', signature,
          amount_lamports: offer.lamports_amount, platform_fee_lamports,
        })

        return updatedOffer
      })
    } catch (err) {
      if (isPostgresUniqueViolation(err)) {
        throw new AppError(409, ErrorCode.DUPLICATE_SIGNATURE, 'This transaction signature has already been recorded')
      }
      throw err
    }

    const resolved = ensureOfferTxUpdated(txResult, 'Offer status changed — it may have already been resolved')

    appEvents.emit('admin.resolve_dispute', {
      adminId: request.user.id, adminWallet: request.user.wallet_address, adminRole: request.user.role,
      disputeId: id, disputeType: 'exchange', winner, signature,
    })
    appEvents.emit('exchange.resolved', {
      offerId: offer.id, sellerId: offer.seller_id, buyerId: offer.buyer_id!,
      winner, currency: offer.fiat_currency, fiatAmount: offer.fiat_amount,
    })

    const detail = await buildOfferDetail(fastify.db, resolved, request.user.id)
    return detail
  })
}

export default adminDisputes
