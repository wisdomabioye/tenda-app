import { FastifyPluginAsync } from 'fastify'
import { ErrorCode } from '@tenda/shared'
import { buildWithdrawEarningsInstruction } from '../../../lib/solana'
import type { BlockchainContract, ApiError } from '@tenda/shared'

type WithdrawEarningsRoute = BlockchainContract['withdrawEarnings']

const withdrawEarnings: FastifyPluginAsync = async (fastify) => {
  // POST /v1/blockchain/withdraw-earnings
  // Builds an unsigned withdraw_earnings Anchor instruction for the user to sign.
  // The instruction transfers earned_sol from the user's on-chain UserAccount to their wallet.
  fastify.post<{
    Body:  WithdrawEarningsRoute['body']
    Reply: WithdrawEarningsRoute['response'] | ApiError
  }>(
    '/withdraw-earnings',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const { amount_lamports } = request.body

      if (!amount_lamports || amount_lamports <= 0) {
        return reply.code(400).send({
          statusCode: 400,
          error: 'Bad Request',
          message: 'amount_lamports must be a positive integer',
          code: ErrorCode.VALIDATION_ERROR,
        })
      }

      try {
        return await buildWithdrawEarningsInstruction(request.user.wallet_address, amount_lamports)
      } catch {
        return reply.code(500).send({
          statusCode: 500,
          error: 'Internal Server Error',
          message: 'Failed to build withdraw-earnings instruction',
          code: ErrorCode.INTERNAL_ERROR,
        })
      }
    }
  )
}

export default withdrawEarnings
