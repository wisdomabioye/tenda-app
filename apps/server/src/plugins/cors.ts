/**
 * CORS policy (S5.5, closes open A3):
 *   - App routes: CORS_ORIGIN list (null = mirror any origin, dev only).
 *   - /v1/admin/*: ADMIN_ORIGIN ONLY — admin origins are deliberately NOT
 *     in the general allow-list, and browser requests to admin routes from
 *     any other origin are hard-blocked. This closes the XSS-exfiltration
 *     path for a leaked admin JWT; mobile clients never call admin routes
 *     and non-browser clients send no Origin header (unaffected).
 */

import fp from 'fastify-plugin'
import cors from '@fastify/cors'
import { ErrorCode } from '@tenda/shared'
import { getConfig } from '@server/config'

const ADMIN_PREFIX = '/v1/admin/'

export default fp(async (fastify) => {
  const { CORS_ORIGIN, ADMIN_ORIGIN } = getConfig()

  // General surface: app origins only (admin origins excluded by design).
  fastify.register(cors, { origin: CORS_ORIGIN ?? true })

  // Admin surface: enforce the origin allow-list before any handler runs.
  fastify.addHook('onRequest', async (request, reply) => {
    if (!request.url.startsWith(ADMIN_PREFIX)) return
    const origin = request.headers.origin
    if (origin === undefined) return // non-browser client — JWT auth still applies
    if (ADMIN_ORIGIN !== null && ADMIN_ORIGIN.includes(origin)) {
      // Mirror the allowed admin origin for the browser's CORS check.
      reply.header('access-control-allow-origin', origin)
      reply.header('vary', 'Origin')
      return
    }
    return reply.code(403).send({
      statusCode: 403,
      error: 'Forbidden',
      message: 'admin routes are not available from this origin',
      code: ErrorCode.FORBIDDEN,
    })
  })
})
