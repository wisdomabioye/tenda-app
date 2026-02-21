import { FastifyPluginAsync } from 'fastify'
import { ErrorCode } from '@tenda/shared'
import { createEscrowInstruction } from '../../../lib/solana'
import { getPlatformConfig } from '../../../lib/platform'
import type { BlockchainContract, ApiError } from '@tenda/shared'

type EscrowRoute = BlockchainContract['createEscrow']

const escrow: FastifyPluginAsync = async (fastify) => {
  // POST /v1/blockchain/create-escrow — compose unsigned escrow instruction
  // Client signs and submits to Solana, then calls POST /v1/gigs/:id/publish with the signature.
  fastify.post<{
    Body: EscrowRoute['body']
    Reply: EscrowRoute['response'] | ApiError
  }>(
    '/create-escrow',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const { gig_id, payment_lamports, payer_address } = request.body

      if (!gig_id || !payment_lamports || !payer_address) {
        return reply.code(400).send({
          statusCode: 400,
          error: 'Bad Request',
          message: 'gig_id, payment_lamports, and payer_address are required',
          code: ErrorCode.VALIDATION_ERROR,
        })
      }

      try {
        const config = await getPlatformConfig(fastify.db)
        const result = createEscrowInstruction(payer_address, gig_id, payment_lamports, config.fee_bps)
        return result
      } catch {
        return reply.code(500).send({
          statusCode: 500,
          error: 'Internal Server Error',
          message: 'Failed to create escrow instruction',
          code: ErrorCode.INTERNAL_ERROR,
        })
      }
    }
  )
}

export default escrow
