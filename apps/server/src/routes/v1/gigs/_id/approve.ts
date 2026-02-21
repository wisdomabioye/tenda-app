import { FastifyPluginAsync } from 'fastify'
import { eq } from 'drizzle-orm'
import { gigs, gig_transactions } from '@tenda/shared/db/schema'
import { ErrorCode } from '@tenda/shared'
import { computePlatformFee, verifyTransactionOnChain } from '../../../../lib/solana'
import { getPlatformConfig } from '../../../../lib/platform'
import type { GigsContract, ApiError } from '@tenda/shared'

type ApproveRoute = GigsContract['approve']

const approveGig: FastifyPluginAsync = async (fastify) => {
  // POST /v1/gigs/:id/approve — poster approves completion + records on-chain tx
  fastify.post<{
    Params: ApproveRoute['params']
    Body: ApproveRoute['body']
    Reply: ApproveRoute['response'] | ApiError
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

      if (gig.status !== 'submitted') {
        return reply.code(400).send({
          statusCode: 400,
          error: 'Bad Request',
          message: 'Gig must be in submitted status to approve',
          code: ErrorCode.GIG_WRONG_STATUS,
        })
      }

      if (gig.poster_id !== request.user.id) {
        return reply.code(403).send({
          statusCode: 403,
          error: 'Forbidden',
          message: 'Only the poster can approve this gig',
          code: ErrorCode.FORBIDDEN,
        })
      }

      // Verify the on-chain transaction before writing to DB
      const verification = await verifyTransactionOnChain(signature)
      if (!verification.ok) {
        return reply.code(400).send({
          statusCode: 400,
          error: 'Bad Request',
          message: 'Transaction not confirmed on-chain',
          code: (verification.error ?? 'SIGNATURE_NOT_FINALIZED') as ErrorCode,
        })
      }

      const config = await getPlatformConfig(fastify.db)
      const platform_fee_lamports = computePlatformFee(gig.payment_lamports, config.fee_bps)

      const updated = await fastify.db.transaction(async (tx) => {
        const [updatedGig] = await tx
          .update(gigs)
          .set({ status: 'completed', updated_at: new Date() })
          .where(eq(gigs.id, id))
          .returning()

        await tx.insert(gig_transactions).values({
          gig_id:               id,
          type:                 'release_payment',
          signature,
          amount_lamports:      gig.payment_lamports,
          platform_fee_lamports,
        })

        return updatedGig
      })

      return updated
    }
  )
}

export default approveGig
