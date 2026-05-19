import fp from 'fastify-plugin'
import postgres from 'postgres'
import { drizzle, PostgresJsDatabase } from 'drizzle-orm/postgres-js'
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
  blocked_keywords,
  reports,
  exchange_offers,
  user_exchange_accounts,
  exchange_proofs,
  exchange_transactions,
  exchange_disputes,
} from '@tenda/shared/db/schema'
import { getConfig } from '@server/config'

const schema = {
  users, gigs, gig_proofs, gig_transactions, disputes, reviews, platform_config,
  conversations, messages, device_tokens, gig_subscriptions,
  blocked_keywords, reports,
  exchange_offers, user_exchange_accounts, exchange_proofs,
  exchange_transactions, exchange_disputes,
}

export type AppDatabase = PostgresJsDatabase<typeof schema>

// Augmentation lives in `src/types/fastify.d.ts` so module-load order
// (ts-node lazy compilation) doesn't determine whether TS sees the decorator.

export default fp(
  async (fastify) => {
    const sql = postgres(getConfig().DATABASE_URL)
    const db = drizzle(sql, { schema })

    fastify.decorate('db', db)

    fastify.addHook('onClose', async () => {
      await sql.end()
    })
  },
  { name: 'db' },
)
