import { FastifyPluginAsync } from 'fastify'
import { and, eq } from 'drizzle-orm'
import { gigs, gig_transactions } from '@tenda/shared/db/schema'
import { ErrorCode, computePlatformFee } from '@tenda/shared'
import { deriveEscrowAddress, ensureSignatureVerified, verifyEscrowFunded } from '@server/lib/solana'
import { getPlatformConfig } from '@server/lib/platform'
import { ensureGigExists, ensureGigStatus, ensureGigOwnership, ensureTxUpdated } from '@server/lib/gigs'
import { handleUniqueConflict } from '@server/lib/db'
import { AppError } from '@server/lib/errors'
import { appEvents } from '@server/lib/events'
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
        throw new AppError(400, ErrorCode.VALIDATION_ERROR, 'signature is required')
      }

      const gig = await ensureGigExists(fastify.db, id)
      ensureGigOwnership(gig, request.user.id, 'poster')
      ensureGigStatus(gig, 'draft')

      if (gig.accept_deadline && new Date(gig.accept_deadline) <= new Date()) {
        throw new AppError(400, ErrorCode.ACCEPT_DEADLINE_PASSED, 'Cannot publish — acceptance deadline has already passed')
      }

      await ensureSignatureVerified(signature, 'create_gig_escrow')

      const [config] = await Promise.all([
        getPlatformConfig(fastify.db),
        verifyEscrowFunded(gig.id, request.user.wallet_address, BigInt(gig.payment_lamports)),
      ])

      const escrow_address = deriveEscrowAddress(gig.id)
      const platform_fee_lamports = computePlatformFee(BigInt(gig.payment_lamports), config.fee_bps)

      let txResult
      try {
        txResult = await fastify.db.transaction(async (tx) => {
          // Include status = 'draft' in WHERE to guard against concurrent publish calls.
          // Without this, a second concurrent publish (same draft, different signature)
          // would overwrite whatever status the gig reached after the first succeeded.
          const [updatedGig] = await tx
            .update(gigs)
            .set({ status: 'open', escrow_address, updated_at: new Date() })
            .where(and(eq(gigs.id, id), eq(gigs.status, 'draft')))
            .returning()

          if (!updatedGig) return null

          await tx.insert(gig_transactions).values({
            gig_id:               id,
            type:                 'create_escrow',
            signature,
            amount_lamports:      gig.payment_lamports + platform_fee_lamports,
            platform_fee_lamports,
          })

          return updatedGig
        })
      } catch (err: unknown) {
        // Postgres unique violation on gig_transactions_signature_unique
        handleUniqueConflict(err, ErrorCode.DUPLICATE_SIGNATURE, 'This transaction signature has already been recorded')
      }

      const updated = ensureTxUpdated(txResult, 'Gig status changed — it may have already been published')

      // Notify subscribers now that the gig is live (status = 'open')
      appEvents.emit('gig.created', {
        gigId:    updated.id,
        city:     updated.city,
        category: updated.category,
        title:    updated.title,
      })

      return updated
    }
  )
}

export default publishGig
