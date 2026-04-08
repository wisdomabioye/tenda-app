import { FastifyPluginAsync } from 'fastify'
import { and, eq } from 'drizzle-orm'
import { gigs, gig_transactions } from '@tenda/shared/db/schema'
import { ErrorCode, computePlatformFee } from '@tenda/shared'
import { ensureSignatureVerified } from '@server/lib/solana'
import { getPlatformConfig } from '@server/lib/platform'
import { ensureGigExists, ensureGigStatus, ensureGigOwnership, ensureTxUpdated } from '@server/lib/gigs'
import { handleUniqueConflict } from '@server/lib/db'
import { AppError } from '@server/lib/errors'
import { appEvents } from '@server/lib/events'
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
        throw new AppError(400, ErrorCode.VALIDATION_ERROR, 'signature is required')
      }

      const gig = await ensureGigExists(fastify.db, id)
      ensureGigStatus(gig, 'submitted')
      ensureGigOwnership(gig, request.user.id, 'poster')

      await ensureSignatureVerified(signature, 'approve_completion')

      // Use the fee locked at escrow creation — recomputing here would give the wrong value
      // if the platform fee config changed between create_escrow and approve.
      const [escrowTx] = await fastify.db
        .select({ platform_fee_lamports: gig_transactions.platform_fee_lamports })
        .from(gig_transactions)
        .where(and(eq(gig_transactions.gig_id, id), eq(gig_transactions.type, 'create_escrow')))
        .limit(1)

      const platform_fee_lamports = escrowTx?.platform_fee_lamports
        ?? computePlatformFee(BigInt(gig.payment_lamports), (await getPlatformConfig(fastify.db)).fee_bps)

      let txResult
      try {
        txResult = await fastify.db.transaction(async (tx) => {
          // Include status = 'submitted' in WHERE to guard against TOCTOU races.
          // A concurrent approve or dispute call could have already transitioned the gig;
          // checking here prevents double-completion and phantom fee records.
          const [updatedGig] = await tx
            .update(gigs)
            .set({ status: 'completed', updated_at: new Date() })
            .where(and(eq(gigs.id, id), eq(gigs.status, 'submitted')))
            .returning()

          if (!updatedGig) return null

          await tx.insert(gig_transactions).values({
            gig_id:               id,
            type:                 'release_payment',
            signature,
            amount_lamports:      gig.payment_lamports,
            platform_fee_lamports,
          })

          return updatedGig
        })
      } catch (err: unknown) {
        // Postgres unique violation on gig_transactions_signature_unique —
        // client retried after a network error; the transaction was already recorded.
        handleUniqueConflict(err, ErrorCode.DUPLICATE_SIGNATURE, 'This transaction signature has already been recorded')
      }

      const updated = ensureTxUpdated(txResult, 'Gig status changed — it may have already been approved or disputed')

      appEvents.emit('gig.approved', {
        gigId:    updated.id,
        posterId: updated.poster_id,
        workerId: updated.worker_id!,
        title:    updated.title,
      })

      return updated
    }
  )
}

export default approveGig
