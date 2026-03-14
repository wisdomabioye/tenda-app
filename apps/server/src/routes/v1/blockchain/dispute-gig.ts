import { FastifyPluginAsync } from 'fastify'
import { ErrorCode } from '@tenda/shared'
import { buildDisputeGigInstruction } from '@server/lib/solana'
import { ensureGigExists, ensureGigStatus } from '@server/lib/gigs'
import { AppError } from '@server/lib/errors'
import type { BlockchainContract, ApiError } from '@tenda/shared'

type DisputeGigRoute = BlockchainContract['disputeGig']

const disputeGig: FastifyPluginAsync = async (fastify) => {
  // POST /v1/blockchain/dispute-gig
  // Builds an unsigned dispute_gig Anchor instruction for the initiator (poster or worker) to sign.
  // After signing on-chain, caller calls POST /v1/gigs/:id/dispute with the signature and reason.
  fastify.post<{
    Body:  DisputeGigRoute['body']
    Reply: DisputeGigRoute['response'] | ApiError
  }>(
    '/dispute-gig',
    { preHandler: [fastify.authenticate] },
    async (request) => {
      const { gig_id, reason } = request.body

      if (!gig_id || !reason) throw new AppError(400, ErrorCode.VALIDATION_ERROR, 'gig_id and reason are required')

      const gig = await ensureGigExists(fastify.db, gig_id)
      ensureGigStatus(gig, 'submitted', 'accepted')

      const userId = request.user.id
      if (gig.poster_id !== userId && gig.worker_id !== userId) {
        throw new AppError(403, ErrorCode.FORBIDDEN, 'Only the poster or worker can dispute this gig')
      }

      try {
        return await buildDisputeGigInstruction(request.user.wallet_address, gig_id, reason)
      } catch {
        throw new AppError(500, ErrorCode.INTERNAL_ERROR, 'Failed to build dispute-gig instruction')
      }
    }
  )
}

export default disputeGig
