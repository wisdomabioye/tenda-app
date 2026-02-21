import fp from 'fastify-plugin'
import cors from '@fastify/cors'
import { getConfig } from '../config'

export default fp(async (fastify) => {
  // In production set CORS_ORIGIN to a comma-separated list of allowed origins,
  // e.g. "https://app.usetenda.com,capacitor://localhost".
  // Unset (local dev): null → mirrors any origin (origin: true).
  const { CORS_ORIGIN } = getConfig()
  fastify.register(cors, { origin: CORS_ORIGIN ?? true })
})
