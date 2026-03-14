import { FastifyPluginAsync } from 'fastify'
import { and, eq } from 'drizzle-orm'
import { gigs, gig_proofs } from '@tenda/shared/db/schema'
import { computeCompletionDeadline, isCloudinaryUrl, ErrorCode } from '@tenda/shared'
import { ensureSignatureVerified } from '@server/lib/solana'
import { ensureGigExists, ensureGigStatus, ensureGigOwnership, ensureTxUpdated } from '@server/lib/gigs'
import { appEvents } from '@server/lib/events'
import { AppError } from '@server/lib/errors'
import { getPlatformConfig } from '@server/lib/platform'
import type { GigsContract, ApiError } from '@tenda/shared'

type SubmitRoute = GigsContract['submit']

const submitGig: FastifyPluginAsync = async (fastify) => {
  // POST /v1/gigs/:id/submit — worker confirms on-chain proof submission and uploads URLs to DB.
  // Caller must first call POST /v1/blockchain/submit-proof to get the unsigned tx,
  // sign + submit to Solana, then call this endpoint with the resulting signature + proofs.
  fastify.post<{
    Params: SubmitRoute['params']
    Body: SubmitRoute['body']
    Reply: SubmitRoute['response'] | ApiError
  }>(
    '/',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const { id } = request.params
      const { proofs, signature } = request.body

      if (!signature) {
        throw new AppError(400, ErrorCode.VALIDATION_ERROR, 'signature is required')
      }

      const gig = await ensureGigExists(fastify.db, id)
      ensureGigStatus(gig, 'accepted')
      ensureGigOwnership(gig, request.user.id, 'worker')

      // accepted_at must always be set when status = 'accepted'; null indicates
      // data corruption — fail safe rather than silently skipping the deadline check.
      if (!gig.accepted_at) {
        fastify.log.error({ gigId: id }, 'Gig in accepted status has no accepted_at — data integrity error')
        return reply.code(500).send({
          statusCode: 500,
          error: 'Internal Server Error',
          message: 'Gig data is inconsistent — please contact support',
          code: ErrorCode.VALIDATION_ERROR,
        })
      }

      // Enforce the submission window: worker has completion_duration_seconds
      // plus the platform grace_period_seconds to submit proof.
      // This mirrors the on-chain check: current_time <= completion_deadline + grace_period.
      {
        const config = await getPlatformConfig(fastify.db)
        const completionDeadline = computeCompletionDeadline(
          new Date(gig.accepted_at),
          gig.completion_duration_seconds,
        )
        const submissionCutoff = new Date(
          completionDeadline.getTime() + config.grace_period_seconds * 1000,
        )
        if (new Date() > submissionCutoff) {
          throw new AppError(400, ErrorCode.GRACE_PERIOD_EXPIRED, 'Submission window has closed (completion deadline + grace period passed)')
        }
      }

      if (!proofs || !Array.isArray(proofs) || proofs.length === 0) {
        throw new AppError(400, ErrorCode.VALIDATION_ERROR, 'At least one proof is required')
      }

      if (proofs.length > 10) {
        throw new AppError(400, ErrorCode.VALIDATION_ERROR, 'Too many proofs — maximum 10 allowed per submission')
      }

      // Validate all proof types are one of the accepted enum values
      const VALID_PROOF_TYPES = ['image', 'video', 'document'] as const
      const invalidType = proofs.find(
        ({ type }) => !VALID_PROOF_TYPES.includes(type as typeof VALID_PROOF_TYPES[number])
      )
      if (invalidType) {
        throw new AppError(400, ErrorCode.VALIDATION_ERROR, 'Proof type must be "image", "video", or "document"')
      }

      // Validate all proof URLs are from Cloudinary CDN
      const invalidProof = proofs.find(({ url }) => !isCloudinaryUrl(url))
      if (invalidProof) {
        throw new AppError(400, ErrorCode.VALIDATION_ERROR, 'All proof URLs must be hosted on Cloudinary (https://res.cloudinary.com/)')
      }

      await ensureSignatureVerified(signature, 'submit_proof')

      const txResult = await fastify.db.transaction(async (tx) => {
        // Include status = 'accepted' in WHERE to guard against TOCTOU races.
        // If two submissions arrive simultaneously, only one will match the UPDATE;
        // the second will get no row back and we return 409 instead of inserting duplicate proofs.
        const [updatedGig] = await tx
          .update(gigs)
          .set({ status: 'submitted', updated_at: new Date() })
          .where(and(eq(gigs.id, id), eq(gigs.status, 'accepted')))
          .returning({ id: gigs.id })

        if (!updatedGig) return null

        return tx
          .insert(gig_proofs)
          .values(proofs.map(({ url, type }) => ({
            gig_id:         id,
            uploaded_by_id: request.user.id,
            url,
            type,
          })))
          .returning()
      })

      const result = ensureTxUpdated(txResult, 'Gig status changed — proof may have already been submitted')

      appEvents.emit('gig.submitted', {
        gigId:    gig.id,
        posterId: gig.poster_id,
        workerId: gig.worker_id!,
        title:    gig.title,
      })

      return reply.code(201).send(result)
    }
  )
}

export default submitGig
