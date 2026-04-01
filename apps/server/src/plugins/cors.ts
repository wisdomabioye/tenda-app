import fp from 'fastify-plugin'
import cors from '@fastify/cors'
import { getConfig } from '@server/config'

export default fp(async (fastify) => {
  // In production set CORS_ORIGIN to a comma-separated list of allowed origins,
  // e.g. "https://app.tendahq.com,capacitor://localhost".
  // Set ADMIN_ORIGIN to the admin panel domain, e.g. "https://admin.tendahq.com".
  // Unset (local dev): null → mirrors any origin (origin: true).
  const { CORS_ORIGIN, ADMIN_ORIGIN } = getConfig()

  const allAllowed = CORS_ORIGIN || ADMIN_ORIGIN
    ? [...(CORS_ORIGIN ?? []), ...(ADMIN_ORIGIN ?? [])]
    : null

  fastify.register(cors, { origin: allAllowed ?? true })
})
