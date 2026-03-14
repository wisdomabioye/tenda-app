import { FastifyPluginAsync } from 'fastify'
import { eq } from 'drizzle-orm'
import { users } from '@tenda/shared/db/schema'
import { ErrorCode } from '@tenda/shared'
import { buildApproveCompletionInstruction } from '@server/lib/solana'
import { ensureGigExists, ensureGigStatus, ensureGigOwnership } from '@server/lib/gigs'
import { AppError } from '@server/lib/errors'
import { getConfig } from '@server/config'
import type { BlockchainContract, ApiError } from '@tenda/shared'

type ApproveEscrowRoute = BlockchainContract['approveEscrow']

const approveEscrow: FastifyPluginAsync = async (fastify) => {
  // POST /v1/blockchain/approve-escrow
  // Builds an unsigned approve_completion Anchor instruction for the poster to sign.
  // Caller must be the poster and the gig must be in 'submitted' status.
  // After signing on-chain, caller calls POST /v1/gigs/:id/approve with the signature.
  fastify.post<{
    Body: ApproveEscrowRoute['body']
    Reply: ApproveEscrowRoute['response'] | ApiError
  }>(
    '/approve-escrow',
    { preHandler: [fastify.authenticate] },
    async (request) => {
      const { gig_id } = request.body

      if (!gig_id) throw new AppError(400, ErrorCode.VALIDATION_ERROR, 'gig_id is required')

      const gig = await ensureGigExists(fastify.db, gig_id)
      ensureGigOwnership(gig, request.user.id, 'poster')
      ensureGigStatus(gig, 'submitted')

      if (!gig.worker_id) throw new AppError(400, ErrorCode.VALIDATION_ERROR, 'Gig has no assigned worker')

      const [worker] = await fastify.db
        .select({ wallet_address: users.wallet_address })
        .from(users)
        .where(eq(users.id, gig.worker_id))
        .limit(1)

      if (!worker) throw new AppError(404, ErrorCode.USER_NOT_FOUND, 'Worker not found')

      try {
        return await buildApproveCompletionInstruction(
          request.user.wallet_address,
          worker.wallet_address,
          gig_id,
          getConfig().SOLANA_TREASURY_ADDRESS,
        )
      } catch {
        throw new AppError(500, ErrorCode.INTERNAL_ERROR, 'Failed to build approve instruction')
      }
    }
  )
}

export default approveEscrow
