import { FastifyPluginAsync } from 'fastify'
import { ErrorCode } from '@tenda/shared'
import { buildCreateUserAccountInstruction } from '../../../lib/solana'
import type { BlockchainContract, ApiError } from '@tenda/shared'

type CreateUserAccountRoute = BlockchainContract['createUserAccount']

const createUserAccount: FastifyPluginAsync = async (fastify) => {
  // POST /v1/blockchain/create-user-account
  // Builds an unsigned create_user_account Anchor instruction for the user to sign.
  // Creates the on-chain UserAccount PDA that tracks earnings and airdrop state.
  // Call once per wallet — the program will reject a second call for the same address.
  fastify.post<{
    Body:  CreateUserAccountRoute['body']
    Reply: CreateUserAccountRoute['response'] | ApiError
  }>(
    '/create-user-account',
    { preHandler: [fastify.authenticate] },
    async (_request, reply) => {
      try {
        return await buildCreateUserAccountInstruction(_request.user.wallet_address)
      } catch {
        return reply.code(500).send({
          statusCode: 500,
          error: 'Internal Server Error',
          message: 'Failed to build create-user-account instruction',
          code: ErrorCode.INTERNAL_ERROR,
        })
      }
    }
  )
}

export default createUserAccount
