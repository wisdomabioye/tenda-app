import { FastifyPluginAsync } from 'fastify'
import { and, eq, or } from 'drizzle-orm'
import { gigs, disputes } from '@tenda/shared/db/schema'
import { MAX_DISPUTE_REASON_LENGTH, ErrorCode } from '@tenda/shared'
import type { GigsContract, ApiError } from '@tenda/shared'
import { isPostgresUniqueViolation } from '../../../../lib/db'

type DisputeRoute = GigsContract['dispute']

const disputeGig: FastifyPluginAsync = async (fastify) => {
  // POST /v1/gigs/:id/dispute — open dispute
  fastify.post<{
    Params: DisputeRoute['params']
    Body: DisputeRoute['body']
    Reply: DisputeRoute['response'] | ApiError
  }>(
    '/',
    { config: { rateLimit: { max: 5, timeWindow: '1 minute' } }, preHandler: [fastify.authenticate] },
    async (request, reply) => {
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

      if (gig.status !== 'submitted' && gig.status !== 'accepted') {
        return reply.code(400).send({
          statusCode: 400,
          error: 'Bad Request',
          message: 'Can only dispute gigs that are accepted or submitted',
          code: ErrorCode.GIG_WRONG_STATUS,
        })
      }

      const { reason } = request.body
      if (!reason || reason.trim().length === 0) {
        return reply.code(400).send({
          statusCode: 400,
          error: 'Bad Request',
          message: 'reason is required',
          code: ErrorCode.VALIDATION_ERROR,
        })
      }

      if (reason.trim().length > MAX_DISPUTE_REASON_LENGTH) {
        return reply.code(400).send({
          statusCode: 400,
          error: 'Bad Request',
          message: `Reason must be at most ${MAX_DISPUTE_REASON_LENGTH} characters`,
          code: ErrorCode.VALIDATION_ERROR,
        })
      }

      const userId = request.user.id
      if (gig.poster_id !== userId && gig.worker_id !== userId) {
        return reply.code(403).send({
          statusCode: 403,
          error: 'Forbidden',
          message: 'Only the poster or worker can dispute this gig',
          code: ErrorCode.FORBIDDEN,
        })
      }

      try {
        const updated = await fastify.db.transaction(async (tx) => {
          // Include the expected statuses in WHERE to guard against TOCTOU races.
          // If the gig was already disputed or approved between our SELECT and this UPDATE,
          // no row is returned and we surface a 409 rather than silently overwriting state.
          const [updatedGig] = await tx
            .update(gigs)
            .set({ status: 'disputed', updated_at: new Date() })
            .where(and(eq(gigs.id, id), or(eq(gigs.status, 'submitted'), eq(gigs.status, 'accepted'))))
            .returning()

          if (!updatedGig) return null

          await tx.insert(disputes).values({
            gig_id: id,
            raised_by_id: userId,
            reason: reason.trim(),
          })

          return updatedGig
        })

        if (!updated) {
          return reply.code(409).send({
            statusCode: 409,
            error: 'Conflict',
            message: 'Gig status changed — it may have already been disputed or completed',
            code: ErrorCode.GIG_WRONG_STATUS,
          })
        }

        return updated
      } catch (err: unknown) {
        // Postgres unique violation on disputes_gig_id_unique
        if (isPostgresUniqueViolation(err)) {
          return reply.code(409).send({
            statusCode: 409,
            error: 'Conflict',
            message: 'A dispute already exists for this gig',
            code: ErrorCode.DISPUTE_ALREADY_EXISTS,
          })
        }
        throw err
      }
    }
  )
}

export default disputeGig
