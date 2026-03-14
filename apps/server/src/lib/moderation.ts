import type { FastifyInstance, FastifyRequest, FastifyReply, FastifyBaseLogger } from 'fastify'
import { blocked_keywords } from '@tenda/shared/db/schema'
import { ErrorCode } from '@tenda/shared'
import type { AppDatabase } from '@server/plugins/db'

const CACHE_TTL_MS = 5 * 60 * 1000 // 5 minutes

interface BlocklistCache {
  // null = no keywords configured yet; caller skips the check entirely
  pattern:  RegExp | null
  loadedAt: number
}

let cache: BlocklistCache = { pattern: null, loadedAt: 0 }

// Promise coalescing: concurrent stale requests share one in-flight DB query
// rather than each firing their own, preventing a thundering herd on cache refresh.
let refreshPromise: Promise<void> | null = null

/** Force the next request to re-fetch keywords from the DB. */
export function invalidateBlocklistCache(): void {
  cache = { pattern: null, loadedAt: 0 }
}

async function doRefresh(db: AppDatabase, log: FastifyBaseLogger): Promise<void> {
  try {
    const rows = await db.select({ keyword: blocked_keywords.keyword }).from(blocked_keywords)

    if (rows.length === 0) {
      cache = { pattern: null, loadedAt: Date.now() }
      return
    }

    // Escape regex special chars on each keyword to prevent ReDoS.
    const escaped = rows.map((r) => r.keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))

    // Unicode-aware word boundaries via property escapes (Node.js 10+, `u` flag required).
    // \p{L} = any Unicode letter, \p{N} = any Unicode number.
    // This correctly handles non-ASCII scripts (Yoruba, Igbo, Hausa, Arabic)
    // where JS's \b only recognises ASCII [a-zA-Z0-9_] as word chars.
    cache = {
      pattern:  new RegExp(`(?<![\\p{L}\\p{N}])(${escaped.join('|')})(?![\\p{L}\\p{N}])`, 'iu'),
      loadedAt: Date.now(),
    }
  } catch (err) {
    log.error({ err }, 'Failed to refresh blocked keywords cache — keeping stale list')
    // Fail closed: retain the previous pattern so moderation stays active.
    // Update loadedAt to prevent an immediate retry storm on the next request.
    cache.loadedAt = Date.now()
  }
}

async function refreshIfStale(db: AppDatabase, log: FastifyBaseLogger): Promise<void> {
  if (Date.now() - cache.loadedAt < CACHE_TTL_MS) return
  if (!refreshPromise) {
    refreshPromise = doRefresh(db, log).finally(() => { refreshPromise = null })
  }
  return refreshPromise
}

async function getBlocklist(db: AppDatabase, log: FastifyBaseLogger): Promise<RegExp | null> {
  await refreshIfStale(db, log)
  return cache.pattern
}

/**
 * preHandler factory for content moderation.
 * Generic over the request body type — TypeScript enforces that `fields` are
 * actual keys of `T`, catching typos at compile time.
 *
 * IMPORTANT: must come AFTER fastify.authenticate in the preHandler array
 * so request.user is populated for the admin bypass check.
 *
 * Example:
 *   preHandler: [fastify.authenticate, moderateBody<CreateRoute['body']>(fastify, ['title', 'description'])]
 */
export function moderateBody<T extends object>(
  fastify: FastifyInstance,
  fields: readonly (keyof T & string)[],
): (request: FastifyRequest, reply: FastifyReply) => Promise<void> {
  return async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    // Admins manage the blocklist — bypass moderation for their own content.
    if (request.user?.role === 'admin') return

    const blocklist = await getBlocklist(fastify.db, fastify.log)
    if (!blocklist) return // No keywords configured yet — skip

    const body = request.body as Record<string, unknown>
    for (const field of fields) {
      const value = body[field]
      if (typeof value !== 'string') continue
      if (blocklist.test(value)) {
        // Log for false-positive analysis without revealing which keyword matched.
        fastify.log.warn({ userId: request.user?.id, field }, 'Content moderation: flagged field')
        return reply.code(400).send({
          statusCode: 400,
          error: 'Bad Request',
          message: 'Content contains disallowed material',
          code: ErrorCode.CONTENT_MODERATED,
        })
      }
    }
  }
}
