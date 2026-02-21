import type { FastifyRequest, FastifyReply } from 'fastify'
import type { UserRole } from '@tenda/shared'
import { ErrorCode } from '@tenda/shared'

/**
 * Fastify preHandler that enforces a minimum role.
 * Always use after fastify.authenticate in the preHandler chain:
 *   { preHandler: [fastify.authenticate, requireRole('admin')] }
 */
export function requireRole(role: UserRole) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    await request.jwtVerify()
    if (request.user.role !== role) {
      return reply.code(403).send({
        statusCode: 403,
        error: 'Forbidden',
        message: 'Insufficient permissions',
        code: ErrorCode.FORBIDDEN,
      })
    }
  }
}
