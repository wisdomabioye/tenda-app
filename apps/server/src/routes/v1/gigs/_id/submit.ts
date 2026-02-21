import { FastifyPluginAsync } from 'fastify'
import { eq } from 'drizzle-orm'
import { gigs, gig_proofs } from '@tenda/shared/db/schema'
import { computeCompletionDeadline, ErrorCode } from '@tenda/shared'
import type { GigsContract, ApiError } from '@tenda/shared'

type SubmitRoute = GigsContract['submit']

const submitGig: FastifyPluginAsync = async (fastify) => {
  // POST /v1/gigs/:id/submit — worker submits proof of work
  fastify.post<{
    Params: SubmitRoute['params']
    Body: SubmitRoute['body']
    Reply: SubmitRoute['response'] | ApiError
  }>(
    '/',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const { id } = request.params
      const { proofs } = request.body

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

      // Enforce completion deadline
      if (gig.accepted_at) {
        const deadline = computeCompletionDeadline(
          new Date(gig.accepted_at),
          gig.completion_duration_seconds,
        )
        if (new Date() > deadline) {
          return reply.code(400).send({
            statusCode: 400,
            error: 'Bad Request',
            message: 'Completion deadline has passed',
            code: ErrorCode.COMPLETION_DEADLINE_PASSED,
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

      const insertedProofs = await fastify.db.transaction(async (tx) => {
        await tx
          .update(gigs)
          .set({ status: 'submitted', updated_at: new Date() })
          .where(eq(gigs.id, id))

        return tx
          .insert(gig_proofs)
          .values(proofs.map(({ url, type }) => ({
            gig_id: id,
            uploaded_by_id: request.user.id,
            url,
            type,
          })))
          .returning()
      })

      return reply.code(201).send(insertedProofs)
    }
  )
}

export default submitGig
