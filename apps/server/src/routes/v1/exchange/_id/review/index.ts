import { FastifyPluginAsync } from 'fastify'
import { eq, sql } from 'drizzle-orm'
import { reviews, users } from '@tenda/shared/db/schema'
import { isValidReviewScore, MAX_REVIEW_COMMENT_LENGTH, ErrorCode } from '@tenda/shared'
import type { ExchangeContract, ApiError } from '@tenda/shared'
import { ensureOfferExists, ensureOfferStatus } from '@server/lib/exchange'
import { handleUniqueConflict } from '@server/lib/db'
import { AppError } from '@server/lib/errors'

type ReviewRoute = ExchangeContract['review']

const reviewExchangeOffer: FastifyPluginAsync = async (fastify) => {
  // POST /v1/exchange/:id/review — leave a review for a completed or resolved offer
  fastify.post<{
    Params: ReviewRoute['params']
    Body: ReviewRoute['body']
    Reply: ReviewRoute['response'] | ApiError
  }>(
    '/',
    { config: { rateLimit: { max: 10, timeWindow: '1 minute' } }, preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const { id } = request.params
      const { score, comment } = request.body
      const reviewerId = request.user.id

      const offer = await ensureOfferExists(fastify.db, id)
      ensureOfferStatus(offer, 'completed', 'resolved')

      // Reviewer must be seller or buyer
      if (offer.seller_id !== reviewerId && offer.buyer_id !== reviewerId) {
        throw new AppError(403, ErrorCode.REVIEW_NOT_ALLOWED, 'Only the seller or buyer can leave a review')
      }

      if (!offer.buyer_id) {
        throw new AppError(400, ErrorCode.VALIDATION_ERROR, 'Cannot review an offer with no buyer')
      }

      if (comment && comment.length > MAX_REVIEW_COMMENT_LENGTH) {
        throw new AppError(400, ErrorCode.VALIDATION_ERROR, `comment must be at most ${MAX_REVIEW_COMMENT_LENGTH} characters`)
      }

      if (!isValidReviewScore(score)) {
        throw new AppError(400, ErrorCode.VALIDATION_ERROR, 'score must be an integer between 1 and 5')
      }

      // Reviewee is the other party
      const revieweeId = offer.seller_id === reviewerId ? offer.buyer_id : offer.seller_id

      try {
        const review = await fastify.db.transaction(async (tx) => {
          const [inserted] = await tx
            .insert(reviews)
            .values({
              offer_id:    id,
              reviewer_id: reviewerId,
              reviewee_id: revieweeId,
              score,
              comment: comment ?? null,
            })
            .returning()

          // Recompute reviewee's reputation score atomically (same formula as gig reviews)
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

        return reply.code(201).send(review)
      } catch (err: unknown) {
        handleUniqueConflict(err, ErrorCode.REVIEW_ALREADY_EXISTS, 'You have already reviewed this offer')
      }
    }
  )
}

export default reviewExchangeOffer
