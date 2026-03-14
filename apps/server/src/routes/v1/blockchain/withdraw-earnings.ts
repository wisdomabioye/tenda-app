import { FastifyPluginAsync } from 'fastify'
import { ErrorCode } from '@tenda/shared'
import { buildWithdrawEarningsInstruction } from '@server/lib/solana'
import { AppError } from '@server/lib/errors'
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
    async (request) => {
      const { amount_lamports } = request.body

      if (!amount_lamports || amount_lamports <= 0) {
        throw new AppError(400, ErrorCode.VALIDATION_ERROR, 'amount_lamports must be a positive integer')
      }

      try {
        return await buildWithdrawEarningsInstruction(request.user.wallet_address, amount_lamports)
      } catch {
        throw new AppError(500, ErrorCode.INTERNAL_ERROR, 'Failed to build withdraw-earnings instruction')
      }
    }
  )
}

export default withdrawEarnings
