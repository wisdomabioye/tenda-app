/**
 * GET /v1/agent/openapi.json — the agent-only subset of the Agent API
 * document (src/agent-api/slim).
 *
 * Public and unauthenticated for the same reason the canonical document is: an
 * agent must be able to discover the contract before it holds anything. The
 * directory is named `openapi.json` so @fastify/autoload mounts the route at
 * exactly the path the document declares for itself (AGENT_SLIM_DOCUMENT_PATH);
 * the guard asserts the two agree, as it does for the canonical one.
 */
import type { FastifyPluginAsync } from 'fastify'
import { AGENT_API_CACHE_SECONDS, type OpenApiDocument } from '@server/agent-api/openapi'
import { AGENT_SLIM_DOCUMENT } from '@server/agent-api/slim'

const agentSlimOpenapiRoute: FastifyPluginAsync = async (fastify) => {
  fastify.get<{ Reply: OpenApiDocument }>('/', async (_request, reply) => {
    reply.header('cache-control', `public, max-age=${AGENT_API_CACHE_SECONDS}`)
    return AGENT_SLIM_DOCUMENT
  })
}

export default agentSlimOpenapiRoute
