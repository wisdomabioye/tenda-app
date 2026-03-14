import { FastifyPluginAsync } from 'fastify'
import { ErrorCode } from '@tenda/shared'
import { buildCancelGigInstruction } from '@server/lib/solana'
import { ensureGigExists, ensureGigStatus, ensureGigOwnership } from '@server/lib/gigs'
import { AppError } from '@server/lib/errors'
import type { BlockchainContract, ApiError } from '@tenda/shared'

type CancelEscrowRoute = BlockchainContract['cancelEscrow']

const cancelEscrow: FastifyPluginAsync = async (fastify) => {
  // POST /v1/blockchain/cancel-escrow
  // Builds an unsigned cancel_gig Anchor instruction for the poster to sign.
  // Caller must be the poster and the gig must be in 'open' status (escrow funded).
  // After signing on-chain, caller calls DELETE /v1/gigs/:id with the signature.
  fastify.post<{
    Body: CancelEscrowRoute['body']
    Reply: CancelEscrowRoute['response'] | ApiError
  }>(
    '/cancel-escrow',
    { preHandler: [fastify.authenticate] },
    async (request) => {
      const { gig_id } = request.body

      if (!gig_id) throw new AppError(400, ErrorCode.VALIDATION_ERROR, 'gig_id is required')

      const gig = await ensureGigExists(fastify.db, gig_id)
      ensureGigOwnership(gig, request.user.id, 'poster', 'Only the poster can cancel this gig')
      ensureGigStatus(gig, 'open')

      try {
        return await buildCancelGigInstruction(request.user.wallet_address, gig_id)
      } catch {
        throw new AppError(500, ErrorCode.INTERNAL_ERROR, 'Failed to build cancel instruction')
      }
    }
  )
}

export default cancelEscrow
