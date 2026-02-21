import fp from 'fastify-plugin'
import fjwt from '@fastify/jwt'
import { FastifyReply, FastifyRequest } from 'fastify'
import type { UserRole } from '@tenda/shared'
import { ErrorCode } from '@tenda/shared'
import { getConfig } from '../config'

declare module 'fastify' {
  interface FastifyInstance {
    authenticate: (request: FastifyRequest, reply: FastifyReply) => Promise<void>
  }
}

declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: { id: string; wallet_address: string; role: UserRole }
    user:    { id: string; wallet_address: string; role: UserRole }
  }
}

export default fp(async (fastify) => {
  fastify.register(fjwt, { secret: getConfig().JWT_SECRET })

  fastify.decorate('authenticate', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      await request.jwtVerify()
    } catch {
      reply.code(401).send({
        statusCode: 401,
        error: 'Unauthorized',
        message: 'Invalid or missing token',
        code: ErrorCode.UNAUTHORIZED,
      })
    }
  })
})
