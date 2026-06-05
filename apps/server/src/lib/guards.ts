import type { FastifyRequest, FastifyReply } from 'fastify'
import { eq } from 'drizzle-orm'
import type { Permission, UserRole } from '@tenda/shared'
import { ErrorCode, ROLE_PERMISSIONS } from '@tenda/shared'
import { users } from '@tenda/shared/db/schema/identity'

/**
 * Fastify preHandler that enforces one of the given roles.
 * Always use after fastify.authenticate in the preHandler chain:
 *   { preHandler: [fastify.authenticate, requireRole('super_admin', 'dispute_admin')] }
 */
export function requireRole(...roles: UserRole[]) {
  const effective = new Set<string>(roles)

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

// Precomputed per-role permission sets — O(1) checks, zero extra queries
// (the role rides the JWT and is refreshed by authenticate's status cache).
const PERMISSION_SETS: ReadonlyMap<string, ReadonlySet<Permission>> = new Map(
  Object.entries(ROLE_PERMISSIONS).map(([role, perms]) => [role, new Set(perms)]),
)

/**
 * In-handler permission check — for routes whose access rule is
 * "permission OR something else" (e.g. dispute threads: escrow party OR
 * disputes.mediate) where a preHandler can't express the disjunction.
 */
export function hasPermission(role: string, permission: Permission): boolean {
  return PERMISSION_SETS.get(role)?.has(permission) ?? false
}

/**
 * Fastify preHandler enforcing a single permission from the shared
 * PERMISSIONS map. Prefer this over requireRole for every admin route —
 * granting a future role is then a map edit in @tenda/shared, not a route
 * sweep. Always use after fastify.authenticate:
 *   { preHandler: [fastify.authenticate, requirePermission('users.suspend')] }
 */
export function requirePermission(permission: Permission) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    if (!hasPermission(request.user.role, permission)) {
      return reply.code(403).send({
        statusCode: 403,
        error: 'Forbidden',
        message: 'Insufficient permissions',
        code: ErrorCode.FORBIDDEN,
      })
    }
  }
}

/**
 * Fastify preHandler enforcing a completed profile (stage-1: first_name AND
 * last_name set) before posting or accepting work. Applied to the v2
 * surface: POST /v1/escrows + escrows accept/decline. Reads the v2 users
 * row per request — only four routes carry this, and profile fields are
 * not in the auth status cache by design (they change via PATCH /users/me
 * and must take effect immediately).
 */
export async function requireProfileComplete(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const rows = await request.server.db
    .select({ first_name: users.first_name, last_name: users.last_name })
    .from(users)
    .where(eq(users.id, request.user.id))
    .limit(1)
  const row = rows[0]
  if (row === undefined || row.first_name === '' || row.last_name === '') {
    return reply.code(403).send({
      statusCode: 403,
      error: 'Forbidden',
      message: 'Complete your profile before posting or accepting work',
      code: ErrorCode.PROFILE_INCOMPLETE,
    })
  }
}
