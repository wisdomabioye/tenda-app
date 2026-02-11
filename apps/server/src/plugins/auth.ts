import fp from 'fastify-plugin'
import fjwt from '@fastify/jwt'
import { FastifyReply, FastifyRequest } from 'fastify'

declare module 'fastify' {
  interface FastifyInstance {
    authenticate: (request: FastifyRequest, reply: FastifyReply) => Promise<void>
  }
}

declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: { id: string; wallet_address: string }
    user: { id: string; wallet_address: string }
  }
}

export default fp(async (fastify) => {
  const secret = process.env.JWT_SECRET
  if (!secret) {
    throw new Error('JWT_SECRET environment variable is required')
  }

  fastify.register(fjwt, { secret })

  fastify.decorate('authenticate', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      await request.jwtVerify()
    } catch (err) {
      reply.code(401).send({ statusCode: 401, error: 'Unauthorized', message: 'Invalid or missing token' })
    }
  })
})
