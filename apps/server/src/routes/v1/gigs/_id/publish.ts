import { FastifyPluginAsync } from 'fastify'
import { eq } from 'drizzle-orm'
import { gigs, gig_transactions } from '@tenda/shared/db/schema'
import { ErrorCode } from '@tenda/shared'
import { deriveEscrowAddress, computePlatformFee, verifyTransactionOnChain } from '../../../../lib/solana'
import { getPlatformConfig } from '../../../../lib/platform'
import type { GigsContract, ApiError } from '@tenda/shared'

type PublishRoute = GigsContract['publish']

const publishGig: FastifyPluginAsync = async (fastify) => {
  // POST /v1/gigs/:id/publish — draft → open
  // Poster calls create_gig_escrow on Solana first, then posts the signature here.
  // Server derives the escrow PDA and records the create_escrow transaction.
  fastify.post<{
    Params: PublishRoute['params']
    Body: PublishRoute['body']
    Reply: PublishRoute['response'] | ApiError
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

      if (gig.poster_id !== request.user.id) {
        return reply.code(403).send({
          statusCode: 403,
          error: 'Forbidden',
          message: 'Only the poster can publish this gig',
          code: ErrorCode.FORBIDDEN,
        })
      }

      if (gig.status !== 'draft') {
        return reply.code(400).send({
          statusCode: 400,
          error: 'Bad Request',
          message: 'Only draft gigs can be published',
          code: ErrorCode.GIG_WRONG_STATUS,
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
      const escrow_address = deriveEscrowAddress(gig.id)
      const platform_fee_lamports = computePlatformFee(gig.payment_lamports, config.fee_bps)

      const updated = await fastify.db.transaction(async (tx) => {
        const [updatedGig] = await tx
          .update(gigs)
          .set({ status: 'open', escrow_address, updated_at: new Date() })
          .where(eq(gigs.id, id))
          .returning()

        await tx.insert(gig_transactions).values({
          gig_id:               id,
          type:                 'create_escrow',
          signature,
          amount_lamports:      gig.payment_lamports + platform_fee_lamports,
          platform_fee_lamports,
        })

        return updatedGig
      })

      return updated
    }
  )
}

export default publishGig
