import { FastifyPluginAsync } from 'fastify'
import { eq, sql } from 'drizzle-orm'
import { gigs, reviews, users } from '@tenda/shared/db/schema'
import { isValidReviewScore, ErrorCode } from '@tenda/shared'
import type { GigsContract, ApiError } from '@tenda/shared'

type ReviewRoute = GigsContract['review']

const reviewGig: FastifyPluginAsync = async (fastify) => {
  // POST /v1/gigs/:id/review — leave a review for a completed or resolved gig
  fastify.post<{
    Params: ReviewRoute['params']
    Body: ReviewRoute['body']
    Reply: ReviewRoute['response'] | ApiError
  }>(
    '/',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const { id } = request.params
      const { score, comment } = request.body
      const reviewerId = request.user.id

      const [gig] = await fastify.db.select().from(gigs).where(eq(gigs.id, id)).limit(1)

      if (!gig) {
        return reply.code(404).send({
          statusCode: 404,
          error: 'Not Found',
          message: 'Gig not found',
          code: ErrorCode.GIG_NOT_FOUND,
        })
      }

      if (gig.status !== 'completed' && gig.status !== 'resolved') {
        return reply.code(400).send({
          statusCode: 400,
          error: 'Bad Request',
          message: 'Can only review completed or resolved gigs',
          code: ErrorCode.GIG_WRONG_STATUS,
        })
      }

      // Reviewer must be poster or worker
      if (gig.poster_id !== reviewerId && gig.worker_id !== reviewerId) {
        return reply.code(403).send({
          statusCode: 403,
          error: 'Forbidden',
          message: 'Only the poster or worker can leave a review',
          code: ErrorCode.REVIEW_NOT_ALLOWED,
        })
      }

      if (!isValidReviewScore(score)) {
        return reply.code(400).send({
          statusCode: 400,
          error: 'Bad Request',
          message: 'score must be an integer between 1 and 5',
          code: ErrorCode.VALIDATION_ERROR,
        })
      }

      // Reviewee is the other party
      const revieweeId = gig.poster_id === reviewerId ? gig.worker_id : gig.poster_id

      if (!revieweeId) {
        return reply.code(400).send({
          statusCode: 400,
          error: 'Bad Request',
          message: 'Cannot determine reviewee — gig has no assigned worker',
          code: ErrorCode.VALIDATION_ERROR,
        })
      }

      try {
        const review = await fastify.db.transaction(async (tx) => {
          const [inserted] = await tx
            .insert(reviews)
            .values({
              gig_id:      id,
              reviewer_id: reviewerId,
              reviewee_id: revieweeId,
              score,
              comment: comment ?? null,
            })
            .returning()

          // Recompute reviewee's reputation score atomically: AVG(score) * 20 → 0–100 scale.
          // Using a single UPDATE … SET … = (SELECT AVG …) avoids a race condition where
          // two concurrent reviews for the same user could both read the same stale average.
          // The subquery runs inside the same transaction and sees the just-inserted row.
          await tx
            .update(users)
            .set({
              reputation_score: sql<number>`(
                SELECT ROUND(AVG(score)::numeric * 20)::int
                FROM ${reviews}
                WHERE reviewee_id = ${revieweeId}
              )`,
              updated_at: new Date(),
            })
            .where(eq(users.id, revieweeId))

          return inserted
        })

        return reply.code(201).send(review)
      } catch (err: unknown) {
        // Postgres unique violation on reviews_gig_reviewer_unique
        if (
          typeof err === 'object' &&
          err !== null &&
          'code' in err &&
          (err as { code: string }).code === '23505'
        ) {
          return reply.code(409).send({
            statusCode: 409,
            error: 'Conflict',
            message: 'You have already reviewed this gig',
            code: ErrorCode.REVIEW_ALREADY_EXISTS,
          })
        }
        throw err
      }
    }
  )
}

export default reviewGig
