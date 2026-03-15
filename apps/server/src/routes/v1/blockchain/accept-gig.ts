import { FastifyPluginAsync } from 'fastify'
import { ErrorCode } from '@tenda/shared'
import { buildAcceptGigInstruction, buildCreateUserAccountInstruction, userAccountExists } from '@server/lib/solana'
import { ensureGigExists, ensureGigStatus } from '@server/lib/gigs'
import { AppError } from '@server/lib/errors'
import type { BlockchainContract, ApiError } from '@tenda/shared'

type AcceptGigRoute = BlockchainContract['acceptGig']

const acceptGig: FastifyPluginAsync = async (fastify) => {
  // POST /v1/blockchain/accept-gig
  // Builds an unsigned accept_gig Anchor instruction for the worker to sign.
  // Caller must not be the poster and the gig must be in 'open' status.
  // After signing on-chain, caller calls POST /v1/gigs/:id/accept with the signature.
  fastify.post<{
    Body: AcceptGigRoute['body']
    Reply: AcceptGigRoute['response'] | ApiError
  }>(
    '/accept-gig',
    { preHandler: [fastify.authenticate] },
    async (request) => {
      const { gig_id } = request.body

      if (!gig_id) throw new AppError(400, ErrorCode.VALIDATION_ERROR, 'gig_id is required')

      const gig = await ensureGigExists(fastify.db, gig_id)

      if (gig.poster_id === request.user.id) {
        throw new AppError(400, ErrorCode.CANNOT_ACCEPT_OWN_GIG, 'Cannot accept your own gig')
      }

      ensureGigStatus(gig, 'open')

      if (gig.accept_deadline && new Date() > new Date(gig.accept_deadline)) {
        throw new AppError(400, ErrorCode.ACCEPT_DEADLINE_PASSED, 'Acceptance deadline has passed')
      }

      try {
        const [acceptResult, accountExists] = await Promise.all([
          buildAcceptGigInstruction(request.user.wallet_address, gig_id),
          userAccountExists(request.user.wallet_address),
        ])

        if (accountExists) return acceptResult

        // Worker has no on-chain UserAccount yet — include a setup transaction.
        // Mobile will sign both in one wallet session and broadcast them sequentially.
        const { transaction: setup_transaction } = await buildCreateUserAccountInstruction(
          request.user.wallet_address,
        )
        return { ...acceptResult, setup_transaction }
      } catch (err) {
        if (err instanceof AppError) throw err
        throw new AppError(500, ErrorCode.INTERNAL_ERROR, 'Failed to build accept-gig instruction')
      }
    }
  )
}

export default acceptGig
