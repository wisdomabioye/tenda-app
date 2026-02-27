import { FastifyPluginAsync } from 'fastify'
import { and, eq } from 'drizzle-orm'
import { gigs, gig_proofs } from '@tenda/shared/db/schema'
import { computeCompletionDeadline, isCloudinaryUrl, ErrorCode } from '@tenda/shared'
import { verifyTransactionOnChain } from '../../../../../lib/solana'
import type { GigsContract, ApiError } from '@tenda/shared'
import { getPlatformConfig } from '../../../../../lib/platform'

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
        return reply.code(400).send({
          statusCode: 400,
          error: 'Bad Request',
          message: 'signature is required',
          code: ErrorCode.VALIDATION_ERROR,
        })
      }

      const [gig] = await fastify.db.select().from(gigs).where(eq(gigs.id, id)).limit(1)

      if (!gig) {
        return reply.code(404).send({
          statusCode: 404,
          error: 'Not Found',
          message: 'Gig not found',
          code: ErrorCode.GIG_NOT_FOUND,
        })
      }

      if (gig.status !== 'accepted') {
        return reply.code(400).send({
          statusCode: 400,
          error: 'Bad Request',
          message: 'Gig must be in accepted status to submit proof',
          code: ErrorCode.GIG_WRONG_STATUS,
        })
      }

      if (gig.worker_id !== request.user.id) {
        return reply.code(403).send({
          statusCode: 403,
          error: 'Forbidden',
          message: 'Only the assigned worker can submit proof',
          code: ErrorCode.FORBIDDEN,
        })
      }

      // Enforce the submission window: worker has completion_duration_seconds
      // plus the platform grace_period_seconds to submit proof.
      // This mirrors the on-chain check: current_time <= completion_deadline + grace_period.
      if (gig.accepted_at) {
        const config = await getPlatformConfig(fastify.db)
        const completionDeadline = computeCompletionDeadline(
          new Date(gig.accepted_at),
          gig.completion_duration_seconds,
        )
        const submissionCutoff = new Date(
          completionDeadline.getTime() + config.grace_period_seconds * 1000,
        )
        if (new Date() > submissionCutoff) {
          return reply.code(400).send({
            statusCode: 400,
            error: 'Bad Request',
            message: 'Submission window has closed (completion deadline + grace period passed)',
            code: ErrorCode.GRACE_PERIOD_EXPIRED,
          })
        }
      }

      if (!proofs || !Array.isArray(proofs) || proofs.length === 0) {
        return reply.code(400).send({
          statusCode: 400,
          error: 'Bad Request',
          message: 'At least one proof is required',
          code: ErrorCode.VALIDATION_ERROR,
        })
      }

      if (proofs.length > 10) {
        return reply.code(400).send({
          statusCode: 400,
          error: 'Bad Request',
          message: 'Too many proofs — maximum 10 allowed per submission',
          code: ErrorCode.VALIDATION_ERROR,
        })
      }

      // Validate all proof types are one of the accepted enum values
      const VALID_PROOF_TYPES = ['image', 'video', 'document'] as const
      const invalidType = proofs.find(
        ({ type }) => !VALID_PROOF_TYPES.includes(type as typeof VALID_PROOF_TYPES[number])
      )
      if (invalidType) {
        return reply.code(400).send({
          statusCode: 400,
          error: 'Bad Request',
          message: 'Proof type must be "image", "video", or "document"',
          code: ErrorCode.VALIDATION_ERROR,
        })
      }

      // Validate all proof URLs are from Cloudinary CDN
      const invalidProof = proofs.find(({ url }) => !isCloudinaryUrl(url))
      if (invalidProof) {
        return reply.code(400).send({
          statusCode: 400,
          error: 'Bad Request',
          message: 'All proof URLs must be hosted on Cloudinary (https://res.cloudinary.com/)',
          code: ErrorCode.VALIDATION_ERROR,
        })
      }

      // Verify the on-chain transaction before updating the DB
      const verification = await verifyTransactionOnChain(signature, 'submit_proof')
      if (!verification.ok) {
        return reply.code(400).send({
          statusCode: 400,
          error: 'Bad Request',
          message: 'Transaction not yet confirmed on-chain',
          code: ErrorCode.SIGNATURE_VERIFICATION_FAILED,
        })
      }

      const result = await fastify.db.transaction(async (tx) => {
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

      if (!result) {
        return reply.code(409).send({
          statusCode: 409,
          error: 'Conflict',
          message: 'Gig status changed — proof may have already been submitted',
          code: ErrorCode.GIG_WRONG_STATUS,
        })
      }

      return reply.code(201).send(result)
    }
  )
}

export default submitGig
