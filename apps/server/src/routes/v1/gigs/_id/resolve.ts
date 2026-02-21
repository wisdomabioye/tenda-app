import { FastifyPluginAsync } from 'fastify'
import { eq } from 'drizzle-orm'
import { gigs, disputes, gig_transactions } from '@tenda/shared/db/schema'
import { ErrorCode } from '@tenda/shared'
import { computePlatformFee, verifyTransactionOnChain } from '../../../../lib/solana'
import { getPlatformConfig } from '../../../../lib/platform'
import { requireRole } from '../../../../lib/guards'
import { isPostgresUniqueViolation } from '../../../../lib/db'
import type { GigsContract, ApiError } from '@tenda/shared'

type ResolveRoute = GigsContract['resolve']

const resolveDispute: FastifyPluginAsync = async (fastify) => {
  // POST /v1/gigs/:id/resolve — admin resolves dispute
  // The authenticated user's wallet address is recorded as the resolver.
  fastify.post<{
    Params: ResolveRoute['params']
    Body: ResolveRoute['body']
    Reply: ResolveRoute['response'] | ApiError
  }>(
    '/',
    { preHandler: [fastify.authenticate, requireRole('admin')] },
    async (request, reply) => {
      const { id } = request.params
      const { winner, signature } = request.body

      if (!winner || !signature) {
        return reply.code(400).send({
          statusCode: 400,
          error: 'Bad Request',
          message: 'winner and signature are required',
          code: ErrorCode.VALIDATION_ERROR,
        })
      }

      // Validate winner against the enum — prevents arbitrary strings being stored
      const VALID_WINNERS = ['poster', 'worker', 'split'] as const
      if (!VALID_WINNERS.includes(winner as typeof VALID_WINNERS[number])) {
        return reply.code(400).send({
          statusCode: 400,
          error: 'Bad Request',
          message: 'winner must be "poster", "worker", or "split"',
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

      if (gig.status !== 'disputed') {
        return reply.code(400).send({
          statusCode: 400,
          error: 'Bad Request',
          message: 'Gig must be in disputed status to resolve',
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
      const platform_fee_lamports = computePlatformFee(gig.payment_lamports, config.fee_bps)
      const resolverWalletAddress = request.user.wallet_address
      const now = new Date()

      let updated
      try {
        updated = await fastify.db.transaction(async (tx) => {
          const [updatedGig] = await tx
            .update(gigs)
            .set({ status: 'resolved', updated_at: now })
            .where(eq(gigs.id, id))
            .returning()

          await tx
            .update(disputes)
            .set({ winner, resolver_wallet_address: resolverWalletAddress, resolved_at: now })
            .where(eq(disputes.gig_id, id))

          await tx.insert(gig_transactions).values({
            gig_id:               id,
            type:                 'dispute_resolved',
            signature,
            amount_lamports:      gig.payment_lamports,
            platform_fee_lamports,
          })

          return updatedGig
        })
      } catch (err: unknown) {
        if (isPostgresUniqueViolation(err)) {
          return reply.code(409).send({
            statusCode: 409,
            error: 'Conflict',
            message: 'This transaction signature has already been recorded',
            code: ErrorCode.DUPLICATE_SIGNATURE,
          })
        }
        throw err
      }

      return updated
    }
  )
}

export default resolveDispute
