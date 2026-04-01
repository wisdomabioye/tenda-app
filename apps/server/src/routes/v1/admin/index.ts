// Parent scope plugin for all /v1/admin/* routes.
// Loaded first by fastify-autoload; all sibling files in this directory
// are registered inside this scope and inherit its hooks.
import { FastifyPluginAsync } from 'fastify'
import { ADMIN_ROLES } from '@tenda/shared'
import { requireRole } from '@server/lib/guards'
import { getConfig } from '@server/config'

const adminScope: FastifyPluginAsync = async (fastify) => {
  // Scoped origin guard: in production, admin routes are only accessible from
  // ADMIN_ORIGIN (the admin panel domain). In dev (ADMIN_ORIGIN unset) all origins pass.
  const { ADMIN_ORIGIN } = getConfig()
  if (ADMIN_ORIGIN) {
    const allowedSet = new Set(ADMIN_ORIGIN)
    fastify.addHook('onRequest', async (request, reply) => {
      const origin = request.headers.origin
      // Allow requests with no Origin header (e.g., server-to-server, curl).
      // Reject browser requests originating from non-admin domains.
      if (origin && !allowedSet.has(origin)) {
        return reply.code(403).send({ statusCode: 403, error: 'Forbidden', message: 'Origin not permitted', code: 'FORBIDDEN' })
      }
    })
  }

  // All admin routes require a valid JWT and at minimum any admin role.
  // Individual routes can add stricter role guards via their preHandler array.
  fastify.addHook('preHandler', fastify.authenticate)
  fastify.addHook('preHandler', requireRole(...ADMIN_ROLES))
}

export default adminScope
