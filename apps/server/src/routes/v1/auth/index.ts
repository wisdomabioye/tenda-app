import { FastifyPluginAsync } from 'fastify'
import { eq } from 'drizzle-orm'
import { users } from '@tenda/shared/db/schema'
import { isValidWalletAddress, ErrorCode } from '@tenda/shared'
import type { AuthContract, ApiError } from '@tenda/shared'
import { verifySignature } from '../../../lib/solana'
import { getConfig } from '../../../config'

type WalletRoute = AuthContract['wallet']
type MeRoute     = AuthContract['me']

const auth: FastifyPluginAsync = async (fastify) => {
  // POST /v1/auth/wallet — verify Solana signature, upsert user, return JWT
  fastify.post<{
    Body: WalletRoute['body']
    Reply: WalletRoute['response'] | ApiError
  }>('/wallet', async (request, reply) => {
    const { wallet_address, signature, message } = request.body

    if (!wallet_address || !signature || !message) {
      return reply.code(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: 'wallet_address, signature, and message are required',
        code: ErrorCode.VALIDATION_ERROR,
      })
    }

    if (!isValidWalletAddress(wallet_address)) {
      return reply.code(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: 'Invalid wallet address format',
        code: ErrorCode.INVALID_WALLET_ADDRESS,
      })
    }

    const isValid = verifySignature(wallet_address, signature, message)
    if (!isValid) {
      return reply.code(401).send({
        statusCode: 401,
        error: 'Unauthorized',
        message: 'Invalid signature',
        code: ErrorCode.INVALID_SIGNATURE,
      })
    }

    // Upsert user
    let [user] = await fastify.db
      .select()
      .from(users)
      .where(eq(users.wallet_address, wallet_address))
      .limit(1)

    if (!user) {
      const [newUser] = await fastify.db
        .insert(users)
        .values({ wallet_address })
        .returning()
      user = newUser
    }

    // Block suspended users from obtaining a token
    if (user.status === 'suspended') {
      return reply.code(403).send({
        statusCode: 403,
        error: 'Forbidden',
        message: 'Account suspended',
        code: ErrorCode.USER_SUSPENDED,
      })
    }

    const token = fastify.jwt.sign(
      { id: user.id, wallet_address: user.wallet_address, role: user.role },
      { expiresIn: getConfig().JWT_EXPIRES_IN },
    )

    return { token, user }
  })

  // GET /v1/auth/me — return current user from JWT
  fastify.get<{
    Reply: MeRoute['response'] | ApiError
  }>('/me', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const [user] = await fastify.db
      .select()
      .from(users)
      .where(eq(users.id, request.user.id))
      .limit(1)

    if (!user) {
      return reply.code(404).send({
        statusCode: 404,
        error: 'Not Found',
        message: 'User not found',
        code: ErrorCode.USER_NOT_FOUND,
      })
    }

    return user
  })
}

export default auth
