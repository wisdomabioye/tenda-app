import { FastifyPluginAsync } from 'fastify'
import { eq, and, inArray } from 'drizzle-orm'
import { gigs, users, gig_proofs, disputes, gig_transactions, reviews } from '@tenda/shared/db/schema'
import {
  isValidPaymentLamports,
  isValidCompletionDuration,
  validateGigDeadlines,
  MAX_GIG_TITLE_LENGTH,
  MAX_GIG_DESCRIPTION_LENGTH,
  ErrorCode,
  computePlatformFee,
  isCrossBorder,
} from '@tenda/shared'
import { ensureSignatureVerified } from '@server/lib/solana'
import { getPlatformConfig } from '@server/lib/platform'
import { ensureGigExists, ensureGigStatus, ensureGigOwnership, ensureTxUpdated, checkAndExpireGig } from '@server/lib/gigs'
import { AppError } from '@server/lib/errors'
import { ensureValidCoordinates } from '@server/lib/validation'
import { moderateBody } from '@server/lib/moderation'

import type { GigsContract, ApiError } from '@tenda/shared'

type GetRoute    = GigsContract['get']
type UpdateRoute = GigsContract['update']
type DeleteRoute = GigsContract['delete']

const gigById: FastifyPluginAsync = async (fastify) => {
  // GET /v1/gigs/:id — single gig with poster/worker, proofs, and dispute
  fastify.get<{
    Params: GetRoute['params']
    Reply: GetRoute['response'] | ApiError
  }>('/', async (request, reply) => {
    const { id } = request.params

    let gig = await ensureGigExists(fastify.db, id)

    // Lazily expire gig if deadline has passed.
    // Grace period is read from platform_config (cached for 5 minutes).
    const config = await getPlatformConfig(fastify.db)
    gig = await checkAndExpireGig(gig, fastify.db, config.grace_period_seconds)

    const userCols = {
      id:               users.id,
      first_name:       users.first_name,
      last_name:        users.last_name,
      avatar_url:       users.avatar_url,
      reputation_score: users.reputation_score,
      is_seeker:        users.is_seeker,
      country:          users.country,
    }

    const userIds = gig.worker_id ? [gig.poster_id, gig.worker_id] : [gig.poster_id]

    // Fetch users (poster + worker), proofs, dispute, and reviews in parallel.
    const [userRows, proofs, disputeRows, gigReviews] = await Promise.all([
      fastify.db.select(userCols).from(users).where(inArray(users.id, userIds)),
      fastify.db.select().from(gig_proofs).where(eq(gig_proofs.gig_id, id)),
      fastify.db.select().from(disputes).where(eq(disputes.gig_id, id)).limit(1),
      fastify.db.select().from(reviews).where(eq(reviews.gig_id, id)),
    ])

    const userMap = new Map(userRows.map((u) => [u.id, u]))
    const poster  = userMap.get(gig.poster_id)!
    const worker  = gig.worker_id ? (userMap.get(gig.worker_id) ?? null) : null

    return reply.send({ ...gig, poster, worker, proofs, dispute: disputeRows[0] ?? null, reviews: gigReviews })
  })

  // PATCH /v1/gigs/:id — update draft gig (poster only)
  fastify.patch<{
    Params: UpdateRoute['params']
    Body: UpdateRoute['body']
    Reply: UpdateRoute['response'] | ApiError
  }>('/', { preHandler: [fastify.authenticate, moderateBody<UpdateRoute['body']>(fastify, ['title', 'description'])] }, async (request, reply) => {
    const { id } = request.params

    const gig = await ensureGigExists(fastify.db, id)
    ensureGigOwnership(gig, request.user.id, 'poster')
    ensureGigStatus(gig, 'draft')

    const {
      title,
      description,
      payment_lamports,
      category,
      country,
      remote,
      city,
      address,
      latitude,
      longitude,
      completion_duration_seconds,
      accept_deadline,
    } = request.body

    if (title !== undefined && title.length > MAX_GIG_TITLE_LENGTH) {
      throw new AppError(400, ErrorCode.VALIDATION_ERROR, `Title must be at most ${MAX_GIG_TITLE_LENGTH} characters`)
    }

    if (description !== undefined && description.length > MAX_GIG_DESCRIPTION_LENGTH) {
      throw new AppError(400, ErrorCode.VALIDATION_ERROR, `Description must be at most ${MAX_GIG_DESCRIPTION_LENGTH} characters`)
    }

    if (payment_lamports !== undefined && !isValidPaymentLamports(payment_lamports)) {
      throw new AppError(400, ErrorCode.VALIDATION_ERROR, 'payment_lamports is out of valid range')
    }

    if (completion_duration_seconds !== undefined && !isValidCompletionDuration(completion_duration_seconds)) {
      throw new AppError(400, ErrorCode.VALIDATION_ERROR, 'completion_duration_seconds must be between 3600 (1 hour) and 7776000 (90 days)')
    }

    // Re-validate deadline combination using effective (updated) values.
    // This catches cases where a new accept_deadline conflicts with existing completion_duration_seconds.
    const effectiveDuration   = completion_duration_seconds ?? gig.completion_duration_seconds
    const effectiveDeadline   = accept_deadline !== undefined
      ? (accept_deadline ?? null)
      : gig.accept_deadline?.toISOString() ?? null
    const deadlineCheck = validateGigDeadlines(effectiveDuration, effectiveDeadline)
    if (!deadlineCheck.valid) {
      throw new AppError(400, ErrorCode.VALIDATION_ERROR, deadlineCheck.error!)
    }

    ensureValidCoordinates(latitude, longitude)

    const updates: Record<string, unknown> = { updated_at: new Date() }
    if (title !== undefined)                       updates.title = title
    if (description !== undefined)                 updates.description = description
    if (payment_lamports !== undefined)            updates.payment_lamports = payment_lamports
    if (category !== undefined)                    updates.category = category
    if (country !== undefined)                     updates.country = country
    if (remote !== undefined)                      updates.remote = remote
    if (city !== undefined)                        updates.city = city
    if (address !== undefined)                     updates.address = address
    if (latitude !== undefined)                    updates.latitude = latitude
    if (longitude !== undefined)                   updates.longitude = longitude
    if (completion_duration_seconds !== undefined) updates.completion_duration_seconds = completion_duration_seconds
    if (accept_deadline !== undefined)             updates.accept_deadline = accept_deadline ? new Date(accept_deadline) : null

    // Recompute cross_border when country or remote changes
    if (country !== undefined || remote !== undefined) {
      const [poster] = await fastify.db
        .select({ country: users.country })
        .from(users)
        .where(eq(users.id, gig.poster_id))
        .limit(1)
      const effectiveRemote  = remote  ?? gig.remote
      const effectiveCountry = country ?? gig.country
      updates.cross_border = isCrossBorder(effectiveRemote, effectiveCountry, poster?.country ?? null)
    }

    // Status guard prevents overwriting a gig that was published between the
    // SELECT above and this UPDATE (draft → open race).
    const [txResult] = await fastify.db
      .update(gigs)
      .set(updates)
      .where(and(eq(gigs.id, id), eq(gigs.status, 'draft')))
      .returning()

    return ensureTxUpdated(txResult, 'Gig status changed — it may have already been published')
  })

  // DELETE /v1/gigs/:id — cancel (poster only)
  // draft: no escrow exists — just update status, no signature needed
  // open:  escrow exists — requires on-chain cancel_gig signature to record refund
  fastify.delete<{
    Params: DeleteRoute['params']
    Body: DeleteRoute['body']
    Reply: DeleteRoute['response'] | ApiError
  }>(
    '/',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const { id } = request.params
      const { signature } = request.body ?? {}

      const gig = await ensureGigExists(fastify.db, id)
      ensureGigOwnership(gig, request.user.id, 'poster')
      ensureGigStatus(gig, 'open', 'draft')

      if (gig.status === 'open' && !signature) {
        throw new AppError(400, ErrorCode.VALIDATION_ERROR, 'signature is required when cancelling an open gig')
      }

      // For open gigs: verify the refund transaction on-chain before recording
      if (gig.status === 'open' && signature) {
        await ensureSignatureVerified(signature, 'cancel_gig')
      }

      if (gig.status === 'open' && signature) {
        const config = await getPlatformConfig(fastify.db)
        const effectiveFeeBps = request.user.is_seeker ? config.seeker_fee_bps : config.fee_bps
        const platform_fee_lamports = computePlatformFee(BigInt(gig.payment_lamports), effectiveFeeBps)

        const cancelled = await fastify.db.transaction(async (tx) => {
          // Include status = 'open' in WHERE to guard against TOCTOU races.
          // A concurrent accept between our SELECT and this UPDATE would leave the
          // gig in 'accepted' state; the status guard causes 0 rows → null → 409.
          const [cancelledGig] = await tx
            .update(gigs)
            .set({ status: 'cancelled', updated_at: new Date() })
            .where(and(eq(gigs.id, id), eq(gigs.status, 'open')))
            .returning()

          if (!cancelledGig) return null

          await tx.insert(gig_transactions).values({
            gig_id:                id,
            type:                  'cancel_refund',
            signature,
            amount_lamports:       gig.payment_lamports + platform_fee_lamports,
            platform_fee_lamports: 0, // full refund — platform takes no fee on cancellation
          })

          return cancelledGig
        })

        return ensureTxUpdated(cancelled, 'Gig status changed — it may have already been accepted or cancelled')
      }

      // Draft cancellation — no escrow, no signature.
      // Status guard prevents a concurrent publish from being silently overwritten.
      const [cancelled] = await fastify.db
        .update(gigs)
        .set({ status: 'cancelled', updated_at: new Date() })
        .where(and(eq(gigs.id, id), eq(gigs.status, 'draft')))
        .returning()

      return ensureTxUpdated(cancelled, 'Gig status changed — it may have already been published or cancelled')
    }
  )
}

export default gigById
