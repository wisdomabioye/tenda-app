/**
 * GET /.well-known/agents/:address.json — the public agent card (#84).
 *
 * PUBLIC AND UNAUTHENTICATED on purpose: it is fetched by strangers' agents and
 * by registries, which is the whole point of a well-known document. The global
 * 100 req/min/IP limiter (plugins/rate-limit) is what bounds it.
 *
 * `autoPrefix` rather than a line in `app.ts`: the routes autoloader walks the
 * whole `routes/` tree, so this FOLDER is the registration.
 *
 * The dot is spelled HERE and not as a `.well-known` directory, and the reason
 * is not that a dot-directory fails to mount — MEASURED 2026-09-05, it mounts
 * perfectly: a probe at `src/routes/.probe/index.ts` served `/.probe/ping`.
 * It is that TypeScript's include globs skip dot-directories, so such a route
 * would be autoloaded and served while never being TYPE-CHECKED. The same probe
 * with a deliberate type error produced zero tsc diagnostics under `.probe2/`
 * and exactly one under `probe3/`. A silently unchecked route is a worse trap
 * than an explicit prefix, and coverage `include` patterns skip dots too.
 */

import type { FastifyPluginAsync } from 'fastify'
import { ErrorCode, normalizeChainAddress } from '@tenda/shared'
import { buildAgentCard, drizzleAgentCardStore } from '@server/features/agent-card'
import { AppError } from '@server/lib/errors'
import { getConfig } from '@server/config'

export const autoPrefix = '/.well-known/agents'

/** `0x` + 40 hex. Checked BEFORE any query — an unbounded path segment must not reach the DB. */
const EVM_ADDRESS = /^0x[0-9a-fA-F]{40}$/

/**
 * REQUIRED, not stripped-if-present. The suffix is part of the key rather than
 * Accept negotiation, and `agentURI` is committed ON-CHAIN — so exactly one
 * spelling may serve, or one agent has two URLs and two cache entries. This is
 * also what /.well-known/assetlinks.json does: registered with its literal
 * suffix, no bare form.
 */
const JSON_SUFFIX = '.json'

/**
 * The card is near-static: it flips ONCE, when the agent registers. So the only
 * staleness a reader can observe is a just-registered agent still reading
 * `registered: false`, bounded by this — while a registry crawling every card it
 * holds costs one database read per address per five minutes rather than one per
 * fetch.
 */
const CACHE_MAX_AGE_SECONDS = 300

const route: FastifyPluginAsync = async (fastify) => {
  const store = drizzleAgentCardStore(fastify.db)

  fastify.get<{ Params: { file: string } }>('/:file', async (request, reply) => {
    // Nothing is left to match when the suffix is absent, so one guard refuses
    // both a bare address and a malformed one.
    const { file } = request.params
    const raw = file.endsWith(JSON_SUFFIX) ? file.slice(0, -JSON_SUFFIX.length) : ''
    if (!EVM_ADDRESS.test(raw)) {
      // Thrown, not hand-rolled: the shared handler (lib/http-errors) is what
      // gives every other route's 404 its four-field envelope.
      throw new AppError(404, ErrorCode.NOT_FOUND, 'not an agent card address')
    }
    // Canonical lowercase, the same normalisation storage uses, so a
    // checksummed URL and a lowercased one are ONE document rather than two.
    const address = normalizeChainAddress('eip155', raw)

    const card = buildAgentCard({
      address,
      api_base_url: getConfig().API_BASE_URL,
      identity: await store.findAgentByAddress(address),
    })

    return reply
      .header('access-control-allow-origin', '*')
      .header('cache-control', `public, max-age=${CACHE_MAX_AGE_SECONDS}`)
      .type('application/json')
      .send(card)
  })
}

export default route
