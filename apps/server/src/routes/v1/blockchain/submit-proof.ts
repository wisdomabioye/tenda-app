import { FastifyPluginAsync } from 'fastify'
import { ErrorCode } from '@tenda/shared'
import { buildSubmitProofInstruction } from '@server/lib/solana'
import { ensureGigExists, ensureGigStatus, ensureGigOwnership } from '@server/lib/gigs'
import { AppError } from '@server/lib/errors'
import type { BlockchainContract, ApiError } from '@tenda/shared'

type SubmitProofRoute = BlockchainContract['submitProof']

const submitProof: FastifyPluginAsync = async (fastify) => {
  // POST /v1/blockchain/submit-proof
  // Builds an unsigned submit_proof Anchor instruction for the worker to sign.
  // Caller must be the assigned worker and the gig must be in 'accepted' status.
  // After signing on-chain, caller calls POST /v1/gigs/:id/submit with the signature + proofs.
  fastify.post<{
    Body: SubmitProofRoute['body']
    Reply: SubmitProofRoute['response'] | ApiError
  }>(
    '/submit-proof',
    { preHandler: [fastify.authenticate] },
    async (request) => {
      const { gig_id } = request.body

      if (!gig_id) throw new AppError(400, ErrorCode.VALIDATION_ERROR, 'gig_id is required')

      const gig = await ensureGigExists(fastify.db, gig_id)
      ensureGigOwnership(gig, request.user.id, 'worker', 'Only the assigned worker can submit proof')
      ensureGigStatus(gig, 'accepted')

      try {
        return await buildSubmitProofInstruction(request.user.wallet_address, gig_id)
      } catch {
        throw new AppError(500, ErrorCode.INTERNAL_ERROR, 'Failed to build submit-proof instruction')
      }
    }
  )
}

export default submitProof
