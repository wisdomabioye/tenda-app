import { FastifyPluginAsync } from 'fastify'

const health: FastifyPluginAsync = async (fastify) => {
  // GET /health — liveness probe for container orchestration / load balancers.
  // Intentionally no auth and no DB query — must respond even if DB is down.
  fastify.get('/', async () => ({
    status: 'ok',
    uptime: Math.floor(process.uptime()),
  }))
}

export default health
