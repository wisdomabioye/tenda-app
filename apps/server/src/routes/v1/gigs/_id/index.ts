import { FastifyPluginAsync } from 'fastify'
import { eq } from 'drizzle-orm'
import { gigs, users, gig_proofs, disputes, gig_transactions } from '@tenda/shared/db/schema'
import {
  isValidPaymentLamports,
  isValidCompletionDuration,
  validateGigDeadlines,
  MAX_GIG_TITLE_LENGTH,
  MAX_GIG_DESCRIPTION_LENGTH,
  ErrorCode,
  computePlatformFee,
} from '@tenda/shared'
import { verifyTransactionOnChain } from '../../../../lib/solana'
import { getPlatformConfig } from '../../../../lib/platform'
import { checkAndExpireGig } from '../../../../lib/gigs'

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

    let [gig] = await fastify.db.select().from(gigs).where(eq(gigs.id, id)).limit(1)

    if (!gig) {
      return reply.code(404).send({
        statusCode: 404,
        error: 'Not Found',
        message: 'Gig not found',
        code: ErrorCode.GIG_NOT_FOUND,
      })
    }

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
    }

    // Fetch poster, worker (if assigned), proofs, and dispute in parallel.
    const [posterRows, workerRows, proofs, disputeRows] = await Promise.all([
      fastify.db.select(userCols).from(users).where(eq(users.id, gig.poster_id)).limit(1),
      gig.worker_id
        ? fastify.db.select(userCols).from(users).where(eq(users.id, gig.worker_id)).limit(1)
        : Promise.resolve([]),
      fastify.db.select().from(gig_proofs).where(eq(gig_proofs.gig_id, id)),
      fastify.db.select().from(disputes).where(eq(disputes.gig_id, id)).limit(1),
    ])

    const poster = posterRows[0]
    const worker = workerRows[0] ?? null

    return { ...gig, poster, worker, proofs, dispute: disputeRows[0] ?? null }
  })

  // PATCH /v1/gigs/:id — update draft gig (poster only)
  fastify.patch<{
    Params: UpdateRoute['params']
    Body: UpdateRoute['body']
    Reply: UpdateRoute['response'] | ApiError
  }>('/', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { id } = request.params

    const [gig] = await fastify.db.select().from(gigs).where(eq(gigs.id, id)).limit(1)

    if (!gig) {
      return reply.code(404).send({
        statusCode: 404,
        error: 'Not Found',
        message: 'Gig not found',
        code: ErrorCode.GIG_NOT_FOUND,
      })
    }

    if (gig.poster_id !== request.user.id) {
      return reply.code(403).send({
        statusCode: 403,
        error: 'Forbidden',
        message: 'Only the poster can update this gig',
        code: ErrorCode.FORBIDDEN,
      })
    }

    if (gig.status !== 'draft') {
      return reply.code(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: 'Can only update gigs that are in draft status',
        code: ErrorCode.GIG_WRONG_STATUS,
      })
    }

    const {
      title,
      description,
      payment_lamports,
      category,
      city,
      address,
      latitude,
      longitude,
      completion_duration_seconds,
      accept_deadline,
    } = request.body

    if (title !== undefined && title.length > MAX_GIG_TITLE_LENGTH) {
      return reply.code(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: `Title must be at most ${MAX_GIG_TITLE_LENGTH} characters`,
        code: ErrorCode.VALIDATION_ERROR,
      })
    }

    if (description !== undefined && description.length > MAX_GIG_DESCRIPTION_LENGTH) {
      return reply.code(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: `Description must be at most ${MAX_GIG_DESCRIPTION_LENGTH} characters`,
        code: ErrorCode.VALIDATION_ERROR,
      })
    }

    if (payment_lamports !== undefined && !isValidPaymentLamports(payment_lamports)) {
      return reply.code(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: 'payment_lamports is out of valid range',
        code: ErrorCode.VALIDATION_ERROR,
      })
    }

    if (completion_duration_seconds !== undefined && !isValidCompletionDuration(completion_duration_seconds)) {
      return reply.code(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: 'completion_duration_seconds must be between 3600 (1 hour) and 7776000 (90 days)',
        code: ErrorCode.VALIDATION_ERROR,
      })
    }

    // Re-validate deadline combination using effective (updated) values.
    // This catches cases where a new accept_deadline conflicts with existing completion_duration_seconds.
    const effectiveDuration   = completion_duration_seconds ?? gig.completion_duration_seconds
    const effectiveDeadline   = accept_deadline !== undefined
      ? (accept_deadline ?? null)
      : gig.accept_deadline?.toISOString() ?? null
    const deadlineCheck = validateGigDeadlines(effectiveDuration, effectiveDeadline)
    if (!deadlineCheck.valid) {
      return reply.code(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: deadlineCheck.error!,
        code: ErrorCode.VALIDATION_ERROR,
      })
    }

    const updates: Record<string, unknown> = { updated_at: new Date() }
    if (title !== undefined)                       updates.title = title
    if (description !== undefined)                 updates.description = description
    if (payment_lamports !== undefined)            updates.payment_lamports = payment_lamports
    if (category !== undefined)                    updates.category = category
    if (city !== undefined)                        updates.city = city
    if (address !== undefined)                     updates.address = address
    if (latitude !== undefined)                    updates.latitude = latitude
    if (longitude !== undefined)                   updates.longitude = longitude
    if (completion_duration_seconds !== undefined) updates.completion_duration_seconds = completion_duration_seconds
    if (accept_deadline !== undefined)             updates.accept_deadline = accept_deadline ? new Date(accept_deadline) : null

    const [updated] = await fastify.db.update(gigs).set(updates).where(eq(gigs.id, id)).returning()

    return updated
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

      const [gig] = await fastify.db.select().from(gigs).where(eq(gigs.id, id)).limit(1)

      if (!gig) {
        return reply.code(404).send({
          statusCode: 404,
          error: 'Not Found',
          message: 'Gig not found',
          code: ErrorCode.GIG_NOT_FOUND,
        })
      }

      if (gig.poster_id !== request.user.id) {
        return reply.code(403).send({
          statusCode: 403,
          error: 'Forbidden',
          message: 'Only the poster can cancel this gig',
          code: ErrorCode.FORBIDDEN,
        })
      }

      if (gig.status !== 'open' && gig.status !== 'draft') {
        return reply.code(400).send({
          statusCode: 400,
          error: 'Bad Request',
          message: 'Can only cancel gigs that are open or draft',
          code: ErrorCode.GIG_WRONG_STATUS,
        })
      }

      if (gig.status === 'open' && !signature) {
        return reply.code(400).send({
          statusCode: 400,
          error: 'Bad Request',
          message: 'signature is required when cancelling an open gig',
          code: ErrorCode.VALIDATION_ERROR,
        })
      }

      // For open gigs: verify the refund transaction on-chain before recording
      if (gig.status === 'open' && signature) {
        const verification = await verifyTransactionOnChain(signature)
        if (!verification.ok) {
          return reply.code(400).send({
            statusCode: 400,
            error: 'Bad Request',
            message: 'Transaction not confirmed on-chain',
            code: (verification.error ?? 'SIGNATURE_NOT_FINALIZED') as ErrorCode,
          })
        }
      }

      if (gig.status === 'open' && signature) {
        const config = await getPlatformConfig(fastify.db)
        const platform_fee_lamports = computePlatformFee(BigInt(gig.payment_lamports), config.fee_bps)

        const cancelled = await fastify.db.transaction(async (tx) => {
          const [cancelledGig] = await tx
            .update(gigs)
            .set({ status: 'cancelled', updated_at: new Date() })
            .where(eq(gigs.id, id))
            .returning()

          await tx.insert(gig_transactions).values({
            gig_id:                id,
            type:                  'cancel_refund',
            signature,
            amount_lamports:       gig.payment_lamports + platform_fee_lamports,
            platform_fee_lamports: 0, // full refund — platform takes no fee on cancellation
          })

          return cancelledGig
        })

        return cancelled
      }

      // Draft cancellation — no escrow, no signature
      const [cancelled] = await fastify.db
        .update(gigs)
        .set({ status: 'cancelled', updated_at: new Date() })
        .where(eq(gigs.id, id))
        .returning()

      return cancelled
    }
  )
}

export default gigById
