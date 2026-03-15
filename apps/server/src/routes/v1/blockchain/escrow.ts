import { FastifyPluginAsync } from 'fastify'
import { ErrorCode } from '@tenda/shared'
import { buildCreateGigEscrowInstruction } from '@server/lib/solana'
import { ensureGigExists, ensureGigStatus, ensureGigOwnership } from '@server/lib/gigs'
import { AppError } from '@server/lib/errors'
import type { BlockchainContract, ApiError } from '@tenda/shared'

type EscrowRoute = BlockchainContract['createEscrow']

const escrow: FastifyPluginAsync = async (fastify) => {
  // POST /v1/blockchain/create-escrow
  // Builds an unsigned create_gig_escrow Anchor instruction for the poster to sign.
  // Caller must be the poster and the gig must be in 'draft' status.
  // After signing on-chain, caller calls POST /v1/gigs/:id/publish with the signature.
  fastify.post<{
    Body: EscrowRoute['body']
    Reply: EscrowRoute['response'] | ApiError
  }>(
    '/create-escrow',
    { preHandler: [fastify.authenticate] },
    async (request) => {
      const { gig_id } = request.body

      if (!gig_id) throw new AppError(400, ErrorCode.VALIDATION_ERROR, 'gig_id is required')

      const gig = await ensureGigExists(fastify.db, gig_id)
      ensureGigOwnership(gig, request.user.id, 'poster', 'Only the poster can publish this gig')
      ensureGigStatus(gig, 'draft')

      try {
        const acceptDeadline = gig.accept_deadline ? new Date(gig.accept_deadline) : null
        return await buildCreateGigEscrowInstruction(
          request.user.wallet_address,
          gig_id,
          BigInt(gig.payment_lamports),
          gig.completion_duration_seconds,
          acceptDeadline,
          request.user.is_seeker,
        )
      } catch (error) {
        fastify.log.error({ err: error }, 'Failed to build create-escrow instruction')
        throw new AppError(500, ErrorCode.INTERNAL_ERROR, 'Failed to build create-escrow instruction')
      }
    }
  )
}

export default escrow
