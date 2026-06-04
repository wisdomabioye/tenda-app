/**
 * Consolidated Fastify type augmentations.
 *
 * Lives here (not inside individual plugin files) so module-augmentation
 * order doesn't depend on the order ts-node compiles plugins at runtime.
 * Before this file existed, `src/plugins/audit.ts` was failing typecheck
 * with `Property 'db' does not exist on FastifyInstance` because audit.ts
 * compiles before db.ts in some lazy paths and TS couldn't see the
 * augmentation declared inside db.ts.
 *
 * All Fastify decorators added by plugins should be declared here. Plugins
 * still IMPLEMENT the decorators; this file just types them.
 */

import type { FastifyReply, FastifyRequest } from 'fastify'
import type { AppDatabase } from '../plugins/db'
// `UserRole` is intentionally NOT imported here. v1's enum and v2's
// `user_role_v2` enum differ (v2 renames 'dispute_resolver' → 'dispute_admin'
// + new values). Until #34 cutover removes the v1 schema, JWT.role is typed
// as `string` so both eras can mint/consume tokens. Restrict-to-v2-enum
// happens at #34.
import type { QueueService } from '../plugins/queue'
import type { ChainRegistry } from '../chains/types'
import type { WsBroadcaster } from '../lib/ws'

declare module 'fastify' {
  interface FastifyInstance {
    /** Drizzle client — registered by `plugins/db.ts`. */
    db: AppDatabase

    /** JWT-auth preHandler — registered by `plugins/auth.ts`. */
    authenticate: (request: FastifyRequest, reply: FastifyReply) => Promise<void>

    /** Bust the moderation blocklist cache — registered by `plugins/moderation.ts`. */
    invalidateBlocklistCache(): void

    /** BullMQ queue service — registered by `plugins/queue.ts`. */
    queue: QueueService

    /** In-process WS pub/sub — registered by `plugins/websocket.ts`. */
    wsBroadcast: WsBroadcaster

    /** Chain adapter registry — registered by `plugins/chains.ts`. */
    chains: ChainRegistry
  }
}

declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: {
      id: string
      wallet_address: string
      role: string
      is_seeker: boolean
      country: string | null
    }
    user: {
      id: string
      wallet_address: string
      role: string
      is_seeker: boolean
      country: string | null
    }
  }
}
