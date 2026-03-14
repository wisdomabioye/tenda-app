import { FastifyPluginAsync } from 'fastify'
import { and, eq, or } from 'drizzle-orm'
import { gigs, disputes } from '@tenda/shared/db/schema'
import { MAX_DISPUTE_REASON_LENGTH, ErrorCode } from '@tenda/shared'
import { ensureSignatureVerified } from '@server/lib/solana'
import { ensureGigExists, ensureGigStatus, ensureTxUpdated } from '@server/lib/gigs'
import { appEvents } from '@server/lib/events'
import { AppError } from '@server/lib/errors'
import { handleUniqueConflict } from '@server/lib/db'
import { moderateBody } from '@server/lib/moderation'
import type { GigsContract, ApiError } from '@tenda/shared'

type DisputeRoute = GigsContract['dispute']

const disputeGig: FastifyPluginAsync = async (fastify) => {
  // POST /v1/gigs/:id/dispute — open dispute
  fastify.post<{
    Params: DisputeRoute['params']
    Body: DisputeRoute['body']
    Reply: DisputeRoute['response'] | ApiError
  }>(
    '/',
    { config: { rateLimit: { max: 5, timeWindow: '1 minute' } }, preHandler: [fastify.authenticate, moderateBody<DisputeRoute['body']>(fastify, ['reason'])] },
    async (request, reply) => {
      const { id } = request.params

      const gig = await ensureGigExists(fastify.db, id)
      ensureGigStatus(gig, 'submitted', 'accepted')

      const { reason, signature } = request.body

      if (!signature) {
        throw new AppError(400, ErrorCode.VALIDATION_ERROR, 'signature is required')
      }

      if (!reason || reason.trim().length === 0) {
        throw new AppError(400, ErrorCode.VALIDATION_ERROR, 'reason is required')
      }

      if (reason.trim().length > MAX_DISPUTE_REASON_LENGTH) {
        throw new AppError(400, ErrorCode.VALIDATION_ERROR, `Reason must be at most ${MAX_DISPUTE_REASON_LENGTH} characters`)
      }

      const userId = request.user.id
      if (gig.poster_id !== userId && gig.worker_id !== userId) {
        throw new AppError(403, ErrorCode.FORBIDDEN, 'Only the poster or worker can dispute this gig')
      }

      // Pre-check: if a dispute already exists, reject before hitting the RPC node
      // so the user doesn't waste gas on a second on-chain transaction.
      const [existingDispute] = await fastify.db
        .select({ id: disputes.id })
        .from(disputes)
        .where(eq(disputes.gig_id, id))
        .limit(1)

      if (existingDispute) {
        throw new AppError(409, ErrorCode.DISPUTE_ALREADY_EXISTS, 'A dispute already exists for this gig')
      }

      await ensureSignatureVerified(signature, 'dispute_gig')

      let txResult
      try {
        txResult = await fastify.db.transaction(async (tx) => {
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
      } catch (err: unknown) {
        // Postgres unique violation on disputes_gig_id_unique
        handleUniqueConflict(err, ErrorCode.DISPUTE_ALREADY_EXISTS, 'A dispute already exists for this gig')
      }

      const updated = ensureTxUpdated(txResult, 'Gig status changed — it may have already been disputed or completed')

      appEvents.emit('gig.disputed', {
        gigId:      updated.id,
        posterId:   updated.poster_id,
        workerId:   updated.worker_id!,
        raisedById: userId,
        title:      updated.title,
      })

      return updated
    }
  )
}

export default disputeGig
