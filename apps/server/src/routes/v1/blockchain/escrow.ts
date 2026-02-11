import { FastifyPluginAsync } from 'fastify'
import { createEscrowInstruction } from '../../../lib/solana'
import type { BlockchainContract, ApiError } from '@tenda/shared'

type EscrowRoute = BlockchainContract['createEscrow']

const escrow: FastifyPluginAsync = async (fastify) => {
  // POST /v1/blockchain/create-escrow — compose escrow instruction
  fastify.post<{
    Body: EscrowRoute['body']
    Reply: EscrowRoute['response'] | ApiError
  }>(
    '/create-escrow',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const { gig_id, amount, payer_address } = request.body

      if (!gig_id || !amount || !payer_address) {
        return reply.code(400).send({
          statusCode: 400,
          error: 'Bad Request',
          message: 'gig_id, amount, and payer_address are required',
        })
      }

      try {
        const result = createEscrowInstruction(payer_address, amount)
        return result
      } catch {
        return reply.code(500).send({
          statusCode: 500,
          error: 'Internal Server Error',
          message: 'Failed to create escrow instruction',
        })
      }
    }
  )
}

export default escrow
