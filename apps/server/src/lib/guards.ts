import type { FastifyRequest, FastifyReply } from 'fastify'
import type { UserRole } from '@tenda/shared'
import { ErrorCode } from '@tenda/shared'

/**
 * Fastify preHandler that enforces one of the given roles.
 * Always use after fastify.authenticate in the preHandler chain:
 *   { preHandler: [fastify.authenticate, requireRole('super_admin', 'support')] }
 *
 * 'admin' is accepted as an alias for 'super_admin' during the transition window
 * (in-flight JWTs issued before the role migration will carry role: 'admin').
 * Remove the alias after one full JWT lifetime (7 days) post-migration.
 */
export function requireRole(...roles: UserRole[]) {
  // Set<string> not Set<UserRole>: JWT.role is widened to string during the
  // v1↔v2 transition window (see types/fastify.d.ts). The runtime check is
  // unchanged — set-membership on the role string.
  const effective = new Set<string>(roles)
  // Backward-compat alias: if super_admin access is required, also accept the legacy 'admin' value
  if (effective.has('super_admin')) effective.add('admin')

  return async (request: FastifyRequest, reply: FastifyReply) => {
    if (!effective.has(request.user.role)) {
      return reply.code(403).send({
        statusCode: 403,
        error: 'Forbidden',
        message: 'Insufficient permissions',
        code: ErrorCode.FORBIDDEN,
      })
    }
  }
}
