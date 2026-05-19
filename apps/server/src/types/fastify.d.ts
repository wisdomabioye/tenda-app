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
import type { UserRole } from '@tenda/shared'
import type { AppDatabase } from '../plugins/db'

declare module 'fastify' {
  interface FastifyInstance {
    /** Drizzle client — registered by `plugins/db.ts`. */
    db: AppDatabase

    /** JWT-auth preHandler — registered by `plugins/auth.ts`. */
    authenticate: (request: FastifyRequest, reply: FastifyReply) => Promise<void>

    /** Bust the moderation blocklist cache — registered by `plugins/moderation.ts`. */
    invalidateBlocklistCache(): void
  }
}

declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: {
      id: string
      wallet_address: string
      role: UserRole
      is_seeker: boolean
      country: string | null
    }
    user: {
      id: string
      wallet_address: string
      role: UserRole
      is_seeker: boolean
      country: string | null
    }
  }
}
