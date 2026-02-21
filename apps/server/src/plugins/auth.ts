import fp from 'fastify-plugin'
import fjwt from '@fastify/jwt'
import { eq } from 'drizzle-orm'
import { FastifyReply, FastifyRequest } from 'fastify'
import { users } from '@tenda/shared/db/schema'
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

// In-process cache of user status keyed by user ID.
// Avoids a DB round-trip on every authenticated request while still
// propagating suspensions within a short window.
const STATUS_CACHE_TTL_MS = 60_000 // 1 minute
const statusCache = new Map<string, { status: string; expiresAt: number }>()

export default fp(async (fastify) => {
  fastify.register(fjwt, { secret: getConfig().JWT_SECRET })

  fastify.decorate('authenticate', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      await request.jwtVerify()
    } catch {
      return reply.code(401).send({
        statusCode: 401,
        error: 'Unauthorized',
        message: 'Invalid or missing token',
        code: ErrorCode.UNAUTHORIZED,
      })
    }

    // Check if the user is suspended. Use the in-process cache to avoid
    // a DB query on every request — cache misses fall back to the DB.
    const userId = request.user.id
    const now = Date.now()
    let cached = statusCache.get(userId)

    if (!cached || now > cached.expiresAt) {
      const [row] = await fastify.db
        .select({ status: users.status })
        .from(users)
        .where(eq(users.id, userId))
        .limit(1)

      if (!row) {
        return reply.code(401).send({
          statusCode: 401,
          error: 'Unauthorized',
          message: 'User no longer exists',
          code: ErrorCode.UNAUTHORIZED,
        })
      }

      cached = { status: row.status, expiresAt: now + STATUS_CACHE_TTL_MS }
      statusCache.set(userId, cached)
    }

    if (cached.status === 'suspended') {
      return reply.code(403).send({
        statusCode: 403,
        error: 'Forbidden',
        message: 'Account suspended',
        code: ErrorCode.USER_SUSPENDED,
      })
    }
  })
})
