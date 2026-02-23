import { FastifyPluginAsync } from 'fastify'
import { and, eq } from 'drizzle-orm'
import { gigs } from '@tenda/shared/db/schema'
import { ErrorCode } from '@tenda/shared'
import { verifyTransactionOnChain } from '../../../../lib/solana'
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

      if (gig.status !== 'open') {
        return reply.code(400).send({
          statusCode: 400,
          error: 'Bad Request',
          message: 'Gig is not open for acceptance',
          code: ErrorCode.GIG_WRONG_STATUS,
        })
      }

      if (gig.poster_id === request.user.id) {
        return reply.code(400).send({
          statusCode: 400,
          error: 'Bad Request',
          message: 'Cannot accept your own gig',
          code: ErrorCode.CANNOT_ACCEPT_OWN_GIG,
        })
      }

      if (gig.accept_deadline && new Date() > new Date(gig.accept_deadline)) {
        return reply.code(400).send({
          statusCode: 400,
          error: 'Bad Request',
          message: 'Acceptance deadline has passed',
          code: ErrorCode.ACCEPT_DEADLINE_PASSED,
        })
      }

      // Verify the on-chain transaction before updating the DB
      const verification = await verifyTransactionOnChain(signature, 'accept_gig')
      if (!verification.ok) {
        return reply.code(400).send({
          statusCode: 400,
          error: 'Bad Request',
          message: 'Transaction not yet confirmed on-chain',
          code: ErrorCode.SIGNATURE_VERIFICATION_FAILED,
        })
      }

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

      if (!updated) {
        return reply.code(409).send({
          statusCode: 409,
          error: 'Conflict',
          message: 'Gig is no longer open — it may have just been accepted by another worker',
          code: ErrorCode.GIG_WRONG_STATUS,
        })
      }

      return updated
    }
  )
}

export default acceptGig
