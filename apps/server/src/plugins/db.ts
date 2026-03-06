import fp from 'fastify-plugin'
import postgres from 'postgres'
import { drizzle, PostgresJsDatabase } from 'drizzle-orm/postgres-js'
import { lookup } from 'node:dns/promises'
import { URL } from 'node:url'
import {
  users,
  gigs,
  gig_proofs,
  gig_transactions,
  disputes,
  reviews,
  platform_config,
  conversations,
  messages,
  device_tokens,
  gig_subscriptions,
} from '@tenda/shared/db/schema'
import { getConfig } from '../config'

const schema = {
  users, gigs, gig_proofs, gig_transactions, disputes, reviews, platform_config,
  conversations, messages, device_tokens, gig_subscriptions,
}

export type AppDatabase = PostgresJsDatabase<typeof schema>

declare module 'fastify' {
  interface FastifyInstance {
    db: PostgresJsDatabase<typeof schema>
  }
}

export default fp(
  async (fastify) => {
    const dbUrl = new URL(getConfig().DATABASE_URL)
    const { address } = await lookup(dbUrl.hostname, { family: 4 })
    dbUrl.hostname = address
    const sql = postgres(dbUrl.toString())
    const db = drizzle(sql, { schema })

    fastify.decorate('db', db)

    fastify.addHook('onClose', async () => {
      await sql.end()
    })
  },
  { name: 'db' },
)
