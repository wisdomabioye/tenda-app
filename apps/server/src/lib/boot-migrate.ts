import { existsSync } from 'node:fs'
import path from 'node:path'
import postgres from 'postgres'
import { drizzle } from 'drizzle-orm/postgres-js'
import { migrate } from 'drizzle-orm/postgres-js/migrator'
import { getConfig } from '@server/config'
import type { FastifyBaseLogger } from 'fastify'

// Anything with pino's info(), keeps tests from having to fake a full logger.
type BootLogger = Pick<FastifyBaseLogger, 'info'>

// Fixed app-wide advisory lock key (0x74656e6461, 'tenda' in hex). Concurrent
// replicas serialize here: the first applies pending migrations, the rest
// acquire the lock after it, find the journal current, and no-op. A string
// (cast to bigint in SQL) because postgres.js's types reject bigint params.
// Exported so boot-seed takes the SAME lock. A separate key would let one
// replica seed while another is mid-migration, writing rows into tables the
// migration is still altering. They run back to back on one boot, and
// migrations are no-ops after the first, so sharing costs nothing.
export const BOOT_LOCK_KEY = '499917939809'

/**
 * How long to wait for the boot lock before giving up.
 *
 * `pg_advisory_lock` waits FOREVER by default, so a replica stuck mid-migration
 * would hang every other replica's boot with no signal — a container that never
 * reports ready and never reports why. `lock_timeout` does apply to it
 * (verified: "canceling statement due to lock timeout"), so a bounded wait is
 * one statement.
 *
 * Generous, because a legitimate first migration on a large table can take
 * minutes and timing that out would be worse than waiting. Failing the boot
 * hands control back to the orchestrator, which restarts and retries — a loud
 * retry beats a silent hang.
 *
 * A crashed holder is NOT the case this protects against: advisory locks are
 * session-scoped and postgres releases them when the connection dies (verified
 * with kill -9). This is for a live-but-wedged holder.
 */
export const BOOT_LOCK_TIMEOUT = '5min'

/**
 * Image layout (/app/migrations, see the runtime stage COPY in the
 * Dockerfile) vs repo layout (dev/tests run with CWD apps/server).
 */
export function resolveMigrationsFolder(): string {
  for (const candidate of ['migrations', 'src/db/migrations']) {
    const abs = path.resolve(process.cwd(), candidate)
    if (existsSync(path.join(abs, 'meta/_journal.json'))) return abs
  }
  throw new Error('MIGRATE_ON_BOOT: no migrations folder found')
}

/**
 * Opt-in boot-time migration (MIGRATE_ON_BOOT=true) for push-button deploys
 * (Coolify et al.). Default off = the image keeps migrate-then-roll semantics
 * via the Dockerfile's `migrate` target. The programmatic migrator reads the
 * same meta/_journal.json and writes the same drizzle.__drizzle_migrations
 * journal as `drizzle-kit migrate`, so the two paths are interchangeable.
 *
 * A failed migration throws; startServer turns that into exit 1, so
 * health-gated rollouts keep the old replicas serving.
 */
export async function migrateOnBoot(log: BootLogger, databaseUrl?: string): Promise<void> {
  if (process.env.MIGRATE_ON_BOOT !== 'true') return

  const folder = resolveMigrationsFolder()
  // Dedicated single connection: the advisory lock is session-scoped and the
  // teardown is clean, independent of the pool the db plugin opens later.
  const sql = postgres(databaseUrl ?? getConfig().DATABASE_URL, { max: 1 })
  try {
    log.info({ folder }, 'MIGRATE_ON_BOOT: waiting for advisory lock')
    // `set_config`, not `SET`: postgres.js turns `${}` into a bind parameter and
    // SET takes no parameters, so `set lock_timeout = $1` is a syntax error.
    await sql`select set_config('lock_timeout', ${BOOT_LOCK_TIMEOUT}, false)`
    await sql`select pg_advisory_lock(${BOOT_LOCK_KEY}::bigint)`
    await migrate(drizzle(sql), { migrationsFolder: folder })
    log.info('MIGRATE_ON_BOOT: migrations current')
  } finally {
    await sql.end() // closes the session, which releases the advisory lock
  }
}
