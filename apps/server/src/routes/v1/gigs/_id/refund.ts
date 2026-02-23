import { FastifyPluginAsync } from 'fastify'
import { eq } from 'drizzle-orm'
import { gigs, gig_transactions } from '@tenda/shared/db/schema'
import { ErrorCode, computePlatformFee } from '@tenda/shared'
import { verifyTransactionOnChain } from '../../../../lib/solana'
import { getPlatformConfig } from '../../../../lib/platform'
import { checkAndExpireGig } from '../../../../lib/gigs'
import { isPostgresUniqueViolation } from '../../../../lib/db'
import type { GigsContract, ApiError } from '@tenda/shared'

type RefundRoute = GigsContract['refund']

const refundExpired: FastifyPluginAsync = async (fastify) => {
  // POST /v1/gigs/:id/refund — poster records the expired-gig refund transaction in the DB.
  // Caller must first call POST /v1/blockchain/refund-expired to get the unsigned tx,
  // sign + submit to Solana, then call this endpoint with the resulting signature.
  // Gig status remains 'expired'; this just records the on-chain refund for transaction history.
  fastify.post<{
    Params: RefundRoute['params']
    Body: RefundRoute['body']
    Reply: RefundRoute['response'] | ApiError
  }>(
    '/',
    { config: { rateLimit: { max: 3, timeWindow: '1 minute' } }, preHandler: [fastify.authenticate] },
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

      let [gig] = await fastify.db.select().from(gigs).where(eq(gigs.id, id)).limit(1)

      if (!gig) {
        return reply.code(404).send({
          statusCode: 404,
          error: 'Not Found',
          message: 'Gig not found',
          code: ErrorCode.GIG_NOT_FOUND,
        })
      }

      // Lazily expire the gig if its deadlines have passed — so a poster who
      // hits this endpoint directly (without first opening the gig detail screen)
      // still gets the correct 'expired' status rather than a misleading 400.
      const config = await getPlatformConfig(fastify.db)
      gig = await checkAndExpireGig(gig, fastify.db, config.grace_period_seconds)

      if (gig.status !== 'expired') {
        return reply.code(400).send({
          statusCode: 400,
          error: 'Bad Request',
          message: 'Only expired gigs can have their escrow refunded',
          code: ErrorCode.GIG_WRONG_STATUS,
        })
      }

      if (gig.poster_id !== request.user.id) {
        return reply.code(403).send({
          statusCode: 403,
          error: 'Forbidden',
          message: 'Only the poster can claim an expired gig refund',
          code: ErrorCode.FORBIDDEN,
        })
      }

      // Verify the on-chain transaction before writing to DB
      const verification = await verifyTransactionOnChain(signature, 'refund_expired')
      if (!verification.ok) {
        return reply.code(400).send({
          statusCode: 400,
          error: 'Bad Request',
          message: 'Transaction not confirmed on-chain',
          code: (verification.error ?? 'SIGNATURE_NOT_FINALIZED') as ErrorCode,
        })
      }

      const platform_fee_lamports = computePlatformFee(BigInt(gig.payment_lamports), config.fee_bps)

      try {
        await fastify.db.insert(gig_transactions).values({
          gig_id:               id,
          type:                 'expired_refund',
          signature,
          amount_lamports:      gig.payment_lamports,
          platform_fee_lamports,
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

      return gig
    }
  )
}

export default refundExpired
