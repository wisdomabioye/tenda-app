import { FastifyPluginAsync } from 'fastify'
import { eq, sql } from 'drizzle-orm'
import { reviews, users } from '@tenda/shared/db/schema'
import { isValidReviewScore, MAX_REVIEW_COMMENT_LENGTH, ErrorCode } from '@tenda/shared'
import type { GigsContract, ApiError } from '@tenda/shared'
import { ensureGigExists, ensureGigStatus } from '@server/lib/gigs'
import { handleUniqueConflict } from '@server/lib/db'
import { AppError } from '@server/lib/errors'
import { moderateBody } from '@server/lib/moderation'
import { appEvents } from '@server/lib/events'

type ReviewRoute = GigsContract['review']

const reviewGig: FastifyPluginAsync = async (fastify) => {
  // POST /v1/gigs/:id/review — leave a review for a completed or resolved gig
  fastify.post<{
    Params: ReviewRoute['params']
    Body: ReviewRoute['body']
    Reply: ReviewRoute['response'] | ApiError
  }>(
    '/',
    { config: { rateLimit: { max: 10, timeWindow: '1 minute' } }, preHandler: [fastify.authenticate, moderateBody<ReviewRoute['body']>(fastify, ['comment'])] },
    async (request, reply) => {
      const { id } = request.params
      const { score, comment } = request.body
      const reviewerId = request.user.id

      const gig = await ensureGigExists(fastify.db, id)
      ensureGigStatus(gig, 'completed', 'resolved')

      // Reviewer must be poster or worker
      if (gig.poster_id !== reviewerId && gig.worker_id !== reviewerId) {
        throw new AppError(403, ErrorCode.REVIEW_NOT_ALLOWED, 'Only the poster or worker can leave a review')
      }

      if (comment && comment.length > MAX_REVIEW_COMMENT_LENGTH) {
        throw new AppError(400, ErrorCode.VALIDATION_ERROR, `comment must be at most ${MAX_REVIEW_COMMENT_LENGTH} characters`)
      }

      if (!isValidReviewScore(score)) {
        throw new AppError(400, ErrorCode.VALIDATION_ERROR, 'score must be an integer between 1 and 5')
      }

      // Reviewee is the other party
      const revieweeId = gig.poster_id === reviewerId ? gig.worker_id : gig.poster_id

      if (!revieweeId) {
        throw new AppError(400, ErrorCode.VALIDATION_ERROR, 'Cannot determine reviewee — gig has no assigned worker')
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

          // Recompute reviewee's reputation score atomically.
          // Formula: AVG(score) * 20 * min(review_count / 10, 1) → 0–100 scale.
          // The confidence factor (min(n/10, 1)) means a user needs 10 reviews to reach
          // full reputation potential — prevents a single 5-star review from scoring 100.
          // Using a single UPDATE … SET … = (SELECT …) avoids a race condition where
          // two concurrent reviews for the same user could both read the same stale value.
          // The subquery runs inside the same transaction and sees the just-inserted row.
          await tx
            .update(users)
            .set({
              reputation_score: sql<number>`(
                SELECT ROUND(AVG(score)::numeric * 20 * LEAST(COUNT(*)::float / 10, 1))::int
                FROM ${reviews}
                WHERE reviewee_id = ${revieweeId}
              )`,
              updated_at: new Date(),
            })
            .where(eq(users.id, revieweeId))

          return inserted
        })

        appEvents.emit('review.submitted', {
          gigId:      id,
          reviewerId: reviewerId,
          revieweeId: revieweeId,
          score:      review.score,
          title:      gig.title,
        })

        return reply.code(201).send(review)
      } catch (err: unknown) {
        // Postgres unique violation on reviews_gig_reviewer_unique
        handleUniqueConflict(err, ErrorCode.REVIEW_ALREADY_EXISTS, 'You have already reviewed this gig')
      }
    }
  )
}

export default reviewGig
