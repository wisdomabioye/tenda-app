import { FastifyPluginAsync } from 'fastify'
import { ErrorCode } from '@tenda/shared'
import { ensureOfferExists } from '@server/lib/exchange'
import { AppError } from '@server/lib/errors'
import type { ApiError } from '@tenda/shared'
import {
  fetchExchangeDisputeByOfferId,
  getThreadForDispute,
  getThreadMessages,
  postThreadMessage,
  markThreadRead,
  type SenderRole,
} from '@server/lib/disputes'

const exchangeDisputeThread: FastifyPluginAsync = async (fastify) => {
  // GET /v1/exchange/:id/dispute/thread — fetch the dispute thread
  // Returns { thread: null } with 200 when no thread exists yet — never 404.
  fastify.get<{
    Params:      { id: string }
    Querystring: { limit?: number; offset?: number }
    Reply: unknown | ApiError
  }>('/', { preHandler: [fastify.authenticate] }, async (request) => {
    const { id } = request.params
    const { limit, offset } = request.query

    const offer = await ensureOfferExists(fastify.db, id)

    const userId = request.user.id
    if (offer.seller_id !== userId && offer.buyer_id !== userId) {
      throw new AppError(403, ErrorCode.FORBIDDEN, 'Only the seller or buyer can view this thread')
    }

    const dispute = await fetchExchangeDisputeByOfferId(fastify.db, id)
    const thread  = await getThreadForDispute(fastify.db, { exchangeDisputeId: dispute.id })

    if (!thread) return { thread: null }

    // party_a = seller, party_b = buyer
    const senderRole: SenderRole = userId === offer.seller_id ? 'party_a' : 'party_b'
    await markThreadRead(fastify.db, thread.id, senderRole)

    const messages = await getThreadMessages(fastify.db, thread.id, { limit, offset })
    return { thread, ...messages }
  })

  // POST /v1/exchange/:id/dispute/thread/messages — user posts a message
  fastify.post<{
    Params: { id: string }
    Body:   { body: string }
    Reply: unknown | ApiError
  }>('/messages', {
    preHandler: [fastify.authenticate],
    config:     { rateLimit: { max: 30, timeWindow: '1 hour' } },
  }, async (request) => {
    const { id } = request.params
    const { body } = request.body

    if (!body || body.trim().length === 0) {
      throw new AppError(400, ErrorCode.VALIDATION_ERROR, 'body is required')
    }
    if (body.trim().length > 2000) {
      throw new AppError(400, ErrorCode.VALIDATION_ERROR, 'body must be at most 2000 characters')
    }

    const offer = await ensureOfferExists(fastify.db, id)

    const userId = request.user.id
    if (offer.seller_id !== userId && offer.buyer_id !== userId) {
      throw new AppError(403, ErrorCode.FORBIDDEN, 'Only the seller or buyer can post to this thread')
    }

    const dispute = await fetchExchangeDisputeByOfferId(fastify.db, id)
    if (dispute.resolved_at) {
      throw new AppError(409, ErrorCode.GIG_WRONG_STATUS, 'This dispute has been resolved')
    }

    const thread = await getThreadForDispute(fastify.db, { exchangeDisputeId: dispute.id })
    if (!thread) {
      throw new AppError(404, ErrorCode.NOT_FOUND, 'No thread has been opened for this dispute yet')
    }

    // party_a = seller, party_b = buyer
    const senderRole: SenderRole = userId === offer.seller_id ? 'party_a' : 'party_b'
    const msg = await postThreadMessage(fastify.db, thread.id, userId, senderRole, body)
    await markThreadRead(fastify.db, thread.id, senderRole)

    return msg
  })
}

export default exchangeDisputeThread
