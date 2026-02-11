import fp from 'fastify-plugin'
import postgres from 'postgres'
import { drizzle, PostgresJsDatabase } from 'drizzle-orm/postgres-js'
import * as schema from '@tenda/shared/db/schema'

declare module 'fastify' {
  interface FastifyInstance {
    db: PostgresJsDatabase<typeof schema>
  }
}

export default fp(async (fastify) => {
  const databaseUrl = process.env.DATABASE_URL
  if (!databaseUrl) {
    throw new Error('DATABASE_URL environment variable is required')
  }

  const sql = postgres(databaseUrl)
  const db = drizzle(sql, { schema })

  fastify.decorate('db', db)

  fastify.addHook('onClose', async () => {
    await sql.end()
  })
})
