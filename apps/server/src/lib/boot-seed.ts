/**
 * Opt-in boot-time registry seed (SEED_ON_BOOT=true), the sibling of
 * `migrateOnBoot`.
 *
 * WHY THIS EXISTS. `db:seed` writes the chain/asset registry from config, and
 * nothing ran it on deploy — so it was run by hand, from whatever artifact was
 * to hand. On 2026-08-06 that artifact was older than the server: it rewrote
 * `chains.escrow_program` to a superseded contract and left the Solana row on a
 * program id from before `df4ea8e`, and the boot guard crash-looped the
 * container. The tell was Solana, whose id comes from the COMPILED IDL rather
 * than env, so no environment could have produced that value — only an older
 * build could.
 *
 * Running the seed in-process removes that failure mode by construction: there
 * is no separate artifact to be stale. The seed sees exactly the env and
 * exactly the IDL the server itself is running.
 *
 * `assertChainRegistryInSync` stays as-is. With SEED_ON_BOOT on it should never
 * fire, which is the point — it goes back to being a backstop for
 * migrate-then-roll deployments rather than the thing that blocks a deploy.
 *
 * Ordering is load-bearing: after `migrateOnBoot` (it writes tables migrations
 * create) and before the chains plugin (whose guard it exists to satisfy).
 */

import postgres from 'postgres'
// `sql` is renamed: the postgres client below is also called `sql`, and a
// shadowed drizzle template silently stringifies a Promise into the query.
import { and, eq, inArray, sql as raw } from 'drizzle-orm'
import { drizzle, type PostgresJsDatabase } from 'drizzle-orm/postgres-js'
import { chains, escrows } from '@tenda/shared/db/schema'
import { UNSETTLED_ESCROW_STATUSES } from '@tenda/shared'
import { getChainSecrets } from '@server/chains/secrets'
import { buildSeedRows, applySeed } from '@server/db/seed-v2'
import { getConfig } from '@server/config'
import { BOOT_LOCK_KEY, BOOT_LOCK_TIMEOUT } from '@server/lib/boot-migrate'
import type { FastifyBaseLogger } from 'fastify'

type BootLogger = Pick<FastifyBaseLogger, 'info' | 'warn'>

/** A chain the seed would switch off, and what it would strand. */
export interface PendingDisable {
  chain_id: string
  /** Escrows whose funds the contract still holds. */
  unsettled: number
}

/**
 * Which of the chains the seed would disable are still holding user funds.
 *
 * Pure so the decision is testable without a database — the two inputs are
 * exactly what the caller reads from one query each.
 *
 * A chain is at risk when it is currently enabled, is NOT in the active
 * config, and has unsettled escrows. Disabling it drops it from
 * `/v1/platform/chains`, which is where mobile learns how to build a
 * transaction — so the holders of those escrows lose the ability to act on
 * them. A chain with only settled escrows is safe to retire.
 */
export function chainsToDisable(
  enabledChainIds: readonly string[],
  activeChainIds: readonly string[],
): string[] {
  const active = new Set(activeChainIds)
  return enabledChainIds.filter((id) => !active.has(id))
}

/**
 * Of those candidates, the ones still holding user funds.
 *
 * Takes the candidate list rather than re-deriving it, and that separation is
 * deliberate: `unsettled` falls back to 0 for a chain absent from the map,
 * which is FAIL-OPEN — an unqueried chain reads as safe to disable. That is
 * only sound while the set counted and the set judged are the same set, so
 * both come from `chainsToDisable` and there is no second predicate to drift.
 */
export function pendingDisables(
  candidates: readonly string[],
  unsettledByChain: ReadonlyMap<string, number>,
): PendingDisable[] {
  return candidates
    .map((chain_id) => ({ chain_id, unsettled: unsettledByChain.get(chain_id) ?? 0 }))
    .filter((d) => d.unsettled > 0)
}

/** The refusal text, kept next to the check so the two cannot drift. */
export function describeBlockedDisable(blocked: readonly PendingDisable[]): string {
  return (
    'refusing to disable chain(s) that still hold user funds:\n' +
    blocked.map((b) => `  ${b.chain_id}: ${b.unsettled} unsettled escrow(s)`).join('\n') +
    '\n  Disabling drops them from /v1/platform/chains, so the people holding those\n' +
    '  escrows can no longer act on them.\n' +
    '  This usually means the deploy is missing that chain\'s CHAIN_* env vars —\n' +
    '  restore them, or set ALLOW_CHAIN_DISABLE=true to retire the chain deliberately.'
  )
}

async function countUnsettledByChain(
  db: PostgresJsDatabase,
  chainIds: readonly string[],
): Promise<Map<string, number>> {
  if (chainIds.length === 0) return new Map()
  const rows = await db
    .select({ chain_id: escrows.chain_id, n: raw<number>`count(*)::int` })
    .from(escrows)
    .where(
      and(
        inArray(escrows.chain_id, [...chainIds]),
        inArray(escrows.status, [...UNSETTLED_ESCROW_STATUSES]),
      ),
    )
    .groupBy(escrows.chain_id)
  return new Map(rows.map((r) => [r.chain_id, r.n]))
}

/**
 * Seed the registry from the running process's own config.
 *
 * Fails the boot on error; `startServer` turns that into exit 1, so a
 * health-gated rollout keeps the old replicas serving rather than promoting a
 * server whose registry is wrong.
 */
export async function seedOnBoot(log: BootLogger, databaseUrl?: string): Promise<void> {
  if (process.env.SEED_ON_BOOT !== 'true') return

  const rows = buildSeedRows(getChainSecrets())
  const activeChainIds = rows.chains.map((c) => c.id)

  const sql = postgres(databaseUrl ?? getConfig().DATABASE_URL, { max: 1 })
  try {
    log.info('SEED_ON_BOOT: waiting for advisory lock')
    // Bounded, for the same reason as boot-migrate: an indefinite wait turns a
    // wedged replica into a silent hang across every other replica.
    // `set_config`, not `SET` — see the note in boot-migrate: SET takes no bind
    // parameters and postgres.js parameterizes every `${}`.
    await sql`select set_config('lock_timeout', ${BOOT_LOCK_TIMEOUT}, false)`
    await sql`select pg_advisory_lock(${BOOT_LOCK_KEY}::bigint)`
    const db = drizzle(sql)

    // The safety check runs BEFORE applySeed, which does the disabling itself —
    // checking afterwards would mean the damage is already committed.
    const enabled = await db
      .select({ id: chains.id })
      .from(chains)
      .where(eq(chains.is_enabled, true))
    const candidates = chainsToDisable(
      enabled.map((r) => r.id),
      activeChainIds,
    )
    const blocked = pendingDisables(candidates, await countUnsettledByChain(db, candidates))

    if (blocked.length > 0) {
      if (process.env.ALLOW_CHAIN_DISABLE !== 'true') {
        throw new Error(`SEED_ON_BOOT: ${describeBlockedDisable(blocked)}`)
      }
      for (const b of blocked) {
        log.warn(
          `SEED_ON_BOOT: disabling ${b.chain_id} with ${b.unsettled} unsettled escrow(s) — ` +
            'acknowledged via ALLOW_CHAIN_DISABLE',
        )
      }
    }

    await applySeed(db, rows)

    // Reported every boot: this is the value that was wrong, so it is the value
    // worth being able to grep for in a deploy log.
    for (const c of rows.chains) {
      log.info(`SEED_ON_BOOT: ${c.id} escrow_program=${c.escrow_program}`)
    }
    for (const s of rows.skipped) log.warn(`SEED_ON_BOOT: skipped ${s}`)
    log.info(
      `SEED_ON_BOOT: registry current — ${rows.chains.length} chain(s), ${rows.assets.length} asset(s)`,
    )
  } finally {
    await sql.end() // closes the session, which releases the advisory lock
  }
}
