import { FastifyPluginAsync } from 'fastify'
import { ErrorCode } from '@tenda/shared'
import { ensureGigExists } from '@server/lib/gigs'
import { AppError } from '@server/lib/errors'
import type { ApiError } from '@tenda/shared'
import {
  fetchGigDisputeByGigId,
  getThreadForDispute,
  getThreadMessages,
  postThreadMessage,
  markThreadRead,
  type SenderRole,
} from '@server/lib/disputes'

const gigDisputeThread: FastifyPluginAsync = async (fastify) => {
  // GET /v1/gigs/:id/dispute/thread — fetch the dispute thread (Fix #40)
  // Returns { thread: null } with 200 when no thread exists yet — never 404.
  fastify.get<{
    Params:      { id: string }
    Querystring: { limit?: number; offset?: number }
    Reply: unknown | ApiError
  }>('/', { preHandler: [fastify.authenticate] }, async (request) => {
    const { id } = request.params
    const { limit, offset } = request.query

    const gig = await ensureGigExists(fastify.db, id)

    const userId = request.user.id
    if (gig.poster_id !== userId && gig.worker_id !== userId) {
      throw new AppError(403, ErrorCode.FORBIDDEN, 'Only the poster or worker can view this thread')
    }

    const dispute = await fetchGigDisputeByGigId(fastify.db, id)
    const thread  = await getThreadForDispute(fastify.db, { gigDisputeId: dispute.id })

    if (!thread) return { thread: null }

    // Determine the caller's role and update last-read pointer
    const senderRole: SenderRole = userId === gig.poster_id ? 'party_a' : 'party_b'
    await markThreadRead(fastify.db, thread.id, senderRole)

    const messages = await getThreadMessages(fastify.db, thread.id, { limit, offset })
    return { thread, ...messages }
  })

  // POST /v1/gigs/:id/dispute/thread/messages — user posts a message (Fix #16)
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

    const gig = await ensureGigExists(fastify.db, id)

    const userId = request.user.id
    if (gig.poster_id !== userId && gig.worker_id !== userId) {
      throw new AppError(403, ErrorCode.FORBIDDEN, 'Only the poster or worker can post to this thread')
    }

    const dispute = await fetchGigDisputeByGigId(fastify.db, id)
    if (dispute.resolved_at) {
      throw new AppError(409, ErrorCode.GIG_WRONG_STATUS, 'This dispute has been resolved')
    }

    const thread = await getThreadForDispute(fastify.db, { gigDisputeId: dispute.id })
    if (!thread) {
      // Fix #40: thread may not exist yet — admins open the thread, users cannot post until it's open
      throw new AppError(404, ErrorCode.NOT_FOUND, 'No thread has been opened for this dispute yet')
    }

    const senderRole: SenderRole = userId === gig.poster_id ? 'party_a' : 'party_b'
    const msg = await postThreadMessage(fastify.db, thread.id, userId, senderRole, body)
    await markThreadRead(fastify.db, thread.id, senderRole)

    return msg
  })
}

export default gigDisputeThread
