import { FastifyPluginAsync } from 'fastify'
import { and, eq } from 'drizzle-orm'
import { gigs, disputes, gig_transactions, users } from '@tenda/shared/db/schema'
import { ErrorCode, computePlatformFee } from '@tenda/shared'
import { ensureSignatureVerified } from '@server/lib/solana'
import { getPlatformConfig } from '@server/lib/platform'
import { ensureGigExists, ensureGigStatus, ensureTxUpdated } from '@server/lib/gigs'
import { requireRole } from '@server/lib/guards'
import { handleUniqueConflict } from '@server/lib/db'
import { AppError } from '@server/lib/errors'
import { appEvents } from '@server/lib/events'
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
        throw new AppError(400, ErrorCode.VALIDATION_ERROR, 'winner and signature are required')
      }

      // Validate winner against the enum — prevents arbitrary strings being stored
      const VALID_WINNERS = ['poster', 'worker', 'split'] as const
      if (!VALID_WINNERS.includes(winner as typeof VALID_WINNERS[number])) {
        throw new AppError(400, ErrorCode.VALIDATION_ERROR, 'winner must be "poster", "worker", or "split"')
      }

      const gig = await ensureGigExists(fastify.db, id)
      ensureGigStatus(gig, 'disputed')

      await ensureSignatureVerified(signature, 'resolve_dispute')

      const [config, posterRow] = await Promise.all([
        getPlatformConfig(fastify.db),
        fastify.db.select({ is_seeker: users.is_seeker }).from(users).where(eq(users.id, gig.poster_id)).limit(1),
      ])
      // Mirror the on-chain fee: seeker posters pay the discounted rate.
      const effectiveFeeBps = posterRow[0]?.is_seeker ? config.seeker_fee_bps : config.fee_bps
      const platform_fee_lamports = computePlatformFee(BigInt(gig.payment_lamports), effectiveFeeBps)
      const resolverWalletAddress = request.user.wallet_address
      const now = new Date()

      let txResult
      try {
        txResult = await fastify.db.transaction(async (tx) => {
          // Include status = 'disputed' in WHERE to guard against concurrent resolves.
          // Two simultaneous admin calls with different signatures would otherwise both
          // "succeed": each UPDATE matches (status already 'resolved' after the first),
          // and both insert a dispute_resolved transaction record.
          const [updatedGig] = await tx
            .update(gigs)
            .set({ status: 'resolved', updated_at: now })
            .where(and(eq(gigs.id, id), eq(gigs.status, 'disputed')))
            .returning()

          if (!updatedGig) return null

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
        handleUniqueConflict(err, ErrorCode.DUPLICATE_SIGNATURE, 'This transaction signature has already been recorded')
      }

      const updated = ensureTxUpdated(txResult, 'Gig status changed — it may have already been resolved')

      appEvents.emit('gig.resolved', {
        gigId:    updated.id,
        posterId: updated.poster_id,
        workerId: updated.worker_id!,
        winner,
        title:    updated.title,
      })

      return updated
    }
  )
}

export default resolveDispute
