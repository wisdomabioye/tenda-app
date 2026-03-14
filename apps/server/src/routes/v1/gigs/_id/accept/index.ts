import { FastifyPluginAsync } from 'fastify'
import { and, eq } from 'drizzle-orm'
import { gigs } from '@tenda/shared/db/schema'
import { ErrorCode } from '@tenda/shared'
import { ensureSignatureVerified } from '@server/lib/solana'
import { ensureGigExists, ensureGigStatus, ensureTxUpdated } from '@server/lib/gigs'
import { appEvents } from '@server/lib/events'
import { AppError } from '@server/lib/errors'
import type { GigsContract, ApiError } from '@tenda/shared'

type AcceptRoute = GigsContract['accept']

const acceptGig: FastifyPluginAsync = async (fastify) => {
  // POST /v1/gigs/:id/accept — worker confirms on-chain acceptance and updates DB.
  // Caller must first call POST /v1/blockchain/accept-gig to get the unsigned tx,
  // sign + submit to Solana, then call this endpoint with the resulting signature.
  fastify.post<{
    Params: AcceptRoute['params']
    Body: AcceptRoute['body']
    Reply: AcceptRoute['response'] | ApiError
  }>(
    '/',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const { id } = request.params
      const { signature } = request.body

      if (!signature) {
        throw new AppError(400, ErrorCode.VALIDATION_ERROR, 'signature is required')
      }

      const gig = await ensureGigExists(fastify.db, id)
      ensureGigStatus(gig, 'open')

      if (gig.poster_id === request.user.id) {
        throw new AppError(400, ErrorCode.CANNOT_ACCEPT_OWN_GIG, 'Cannot accept your own gig')
      }

      if (gig.accept_deadline && new Date() > new Date(gig.accept_deadline)) {
        throw new AppError(400, ErrorCode.ACCEPT_DEADLINE_PASSED, 'Acceptance deadline has passed')
      }

      await ensureSignatureVerified(signature, 'accept_gig')

      const now = new Date()
      // Include status = 'open' in the WHERE clause to guard against TOCTOU races.
      // If another request accepted this gig between our SELECT and this UPDATE,
      // no row will be returned and we respond 409 instead of silently overwriting worker_id.
      const [updated] = await fastify.db
        .update(gigs)
        .set({
          worker_id:   request.user.id,
          status:      'accepted',
          accepted_at: now,
          updated_at:  now,
        })
        .where(and(eq(gigs.id, id), eq(gigs.status, 'open')))
        .returning()

      const accepted = ensureTxUpdated(updated, 'Gig is no longer open — it may have just been accepted by another worker')

      appEvents.emit('gig.accepted', {
        gigId:    accepted.id,
        posterId: accepted.poster_id,
        workerId: accepted.worker_id!,
        title:    accepted.title,
      })

      return accepted
    }
  )
}

export default acceptGig
