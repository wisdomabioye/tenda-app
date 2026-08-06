/**
 * lib/boot-seed.ts — opt-in boot-time registry seed (SEED_ON_BOOT=true).
 *
 * Mirrors boot-migrate's shape: flag-gated (unset = never connects, proven with
 * a dead-port URL), advisory-locked, and DB-backed cases gated on
 * TEST_DATABASE_URL.
 *
 * The case that matters is the disable guard. `applySeed` ends by switching off
 * every chain outside the active config, so a deploy that loses a chain's
 * CHAIN_* env vars would drop it from /v1/platform/chains and strand anyone
 * holding an unsettled escrow there. These prove the guard refuses that boot,
 * that it does NOT refuse a harmless retirement, and that the DB is left
 * untouched when it refuses — a guard that throws after writing is no guard.
 */
import { test } from 'node:test'
import assert from 'node:assert'
import postgres from 'postgres'
import { drizzle } from 'drizzle-orm/postgres-js'
import { eq } from 'drizzle-orm'
import { chains } from '@tenda/shared/db/schema'
import { TEST_DB_CONFIGURED, useSuiteLock } from '../helpers/test-app'
import {
  seedOnBoot,
  lockChainsForRetirement,
  NO_CHAINS_CONFIGURED,
} from '@server/lib/boot-seed'
import { resetChainSecretsCache } from '@server/chains/secrets'

const skip = !TEST_DB_CONFIGURED

// Like seed-upsert: this suite drives the real `applySeed` against the shared
// registry with its own client, outside the app harness. Without the
// cross-process lock a sibling suite's `resetDb` TRUNCATE wipes the probe rows
// mid-test AND this file's registry writes collide with that suite's re-seed
// INSERT. Both were observed in a full run; each file passes alone.
useSuiteLock()
const log = { info: () => {}, warn: () => {} }
// Refuses instantly (ECONNREFUSED) — proves the flag gate without a timeout.
const DEAD_DB_URL = 'postgresql://postgres:postgres@127.0.0.1:59999/nope'

async function withEnv(vars: Record<string, string>, fn: () => Promise<void>): Promise<void> {
  const prior = new Map(Object.keys(vars).map((k) => [k, process.env[k]]))
  Object.assign(process.env, vars)
  try {
    await fn()
  } finally {
    for (const [k, v] of prior) {
      if (v === undefined) delete process.env[k]
      else process.env[k] = v
    }
  }
}

/**
 * Minimal rows for a chain that is enabled, absent from every CHAIN_* var, and
 * (optionally) holding an escrow the contract has not released. Written as raw
 * SQL rather than via the app factories because those bind to TEST_CHAIN_ID,
 * and this needs a chain the active config has never heard of.
 */
async function seedProbeChain(
  sql: postgres.Sql,
  chainId: string,
  opts: { withUnsettledEscrow: boolean },
): Promise<void> {
  await sql`
    insert into chains (id, namespace, display_name, treasury_address, escrow_program, is_enabled)
    values (${chainId}, 'eip155', 'probe', '0xbeef', '0xdead', true)
    on conflict (id) do update set is_enabled = true`
  if (!opts.withUnsettledEscrow) return
  const asset = `PROBE_${chainId}`
  await sql`
    insert into assets (id, chain_id, symbol, decimals)
    values (${asset}, ${chainId}, 'PROBE', 6)
    on conflict (id) do nothing`
  const [user] = await sql`insert into users default values returning id`
  await sql`
    insert into escrows (kind, chain_id, asset, amount_raw, creator_id, status)
    values ('gig', ${chainId}, ${asset}, '1', ${user.id}, 'accepted')`
}

async function dropProbeChain(sql: postgres.Sql, chainId: string): Promise<void> {
  await sql`delete from escrows where chain_id = ${chainId}`
  await sql`delete from assets where chain_id = ${chainId}`
  await sql`delete from chains where id = ${chainId}`
}

test('no-op unless SEED_ON_BOOT=true — an unset flag never opens a connection', async () => {
  // The dead port is the assertion: if the flag gate were removed this would
  // reject with ECONNREFUSED instead of resolving.
  delete process.env.SEED_ON_BOOT
  await seedOnBoot(log, DEAD_DB_URL)
})

test('SEED_ON_BOOT set to anything other than "true" is still a no-op', async () => {
  await withEnv({ SEED_ON_BOOT: '1' }, async () => {
    await seedOnBoot(log, DEAD_DB_URL)
  })
})

test('the flag gate is what stops it — with the flag on, the dead URL surfaces', async () => {
  // Guards the guard: without this, the two no-op tests above would pass even
  // if seedOnBoot did nothing at all under any configuration.
  await withEnv({ SEED_ON_BOOT: 'true' }, async () => {
    await assert.rejects(() => seedOnBoot(log, DEAD_DB_URL))
  })
})

test(
  'refuses to disable a chain holding unsettled escrows, and writes nothing',
  { skip },
  async () => {
    const url = process.env.TEST_DATABASE_URL!
    const sql = postgres(url, { max: 1 })
    const db = drizzle(sql)
    const CHAIN = 'eip155:999999'
    try {
      await seedProbeChain(sql, CHAIN, { withUnsettledEscrow: true })

      await withEnv({ SEED_ON_BOOT: 'true' }, async () => {
        await assert.rejects(
          () => seedOnBoot(log, url),
          /refusing to disable chain\(s\) that still hold user funds/,
        )
      })

      // The refusal must precede applySeed, or the damage is already done.
      const [row] = await db.select().from(chains).where(eq(chains.id, CHAIN))
      assert.strictEqual(row?.is_enabled, true, 'chain was disabled despite the refusal')
    } finally {
      await dropProbeChain(sql, CHAIN)
      await sql.end()
    }
  },
)

test('ALLOW_CHAIN_DISABLE=true lets a deliberate retirement through', { skip }, async () => {
  const url = process.env.TEST_DATABASE_URL!
  const sql = postgres(url, { max: 1 })
  const db = drizzle(sql)
  const CHAIN = 'eip155:999998'
  try {
    await seedProbeChain(sql, CHAIN, { withUnsettledEscrow: true })

    await withEnv({ SEED_ON_BOOT: 'true', ALLOW_CHAIN_DISABLE: 'true' }, async () => {
      await seedOnBoot(log, url)
    })

    const [row] = await db.select().from(chains).where(eq(chains.id, CHAIN))
    assert.strictEqual(row?.is_enabled, false, 'acknowledged disable did not take effect')
  } finally {
    await dropProbeChain(sql, CHAIN)
    await sql.end()
  }
})

test('a deploy with no chains configured is named, not left to drizzle', async () => {
  // loadChainSecrets returns an EMPTY map rather than throwing when no CHAIN_*
  // vars are set, so without this guard the next thing the operator sees is
  // "values() must be called with at least one value" — a message that names
  // neither chains nor env. The dead URL doubles as proof it fails BEFORE
  // opening a connection.
  const removed = new Map<string, string>()
  for (const k of Object.keys(process.env)) {
    if (k.startsWith('CHAIN_')) {
      removed.set(k, process.env[k]!)
      delete process.env[k]
    }
  }
  resetChainSecretsCache()
  try {
    await withEnv({ SEED_ON_BOOT: 'true' }, async () => {
      await assert.rejects(() => seedOnBoot(log, DEAD_DB_URL), (e: Error) => {
        assert.strictEqual(e.message, NO_CHAINS_CONFIGURED)
        assert.match(e.message, /CHAIN_\* secret/)
        return true
      })
    })
  } finally {
    for (const [k, v] of removed) process.env[k] = v
    resetChainSecretsCache()
  }
})

test(
  'locking a retiring chain blocks escrow creation on it — the count cannot go stale',
  { skip },
  async () => {
    // The guard counts unsettled escrows, then disables. Without a lock an
    // escrow funded between those two steps is stranded by a guard that already
    // reported all-clear. escrows.chain_id FKs chains.id, so an escrow INSERT
    // takes FOR KEY SHARE on the chain row and FOR UPDATE conflicts with it.
    const url = process.env.TEST_DATABASE_URL!
    const holder = postgres(url, { max: 1 })
    const writer = postgres(url, { max: 1 })
    const setup = postgres(url, { max: 1 })
    const CHAIN = 'eip155:999996'
    const ASSET = `PROBE_${CHAIN}`
    try {
      await seedProbeChain(setup, CHAIN, { withUnsettledEscrow: false })
      await setup`
        insert into assets (id, chain_id, symbol, decimals)
        values (${ASSET}, ${CHAIN}, 'PROBE', 6) on conflict (id) do nothing`
      const [user] = await setup`insert into users default values returning id`

      const insertEscrow = async (sql: postgres.Sql): Promise<'ok' | 'blocked'> => {
        try {
          await sql`select set_config('lock_timeout', '1s', false)`
          await sql`
            insert into escrows (kind, chain_id, asset, amount_raw, creator_id, status)
            values ('gig', ${CHAIN}, ${ASSET}, '1', ${user.id}, 'accepted')`
          return 'ok'
        } catch (e) {
          // 55P03 = lock_not_available, what lock_timeout raises. Narrowed
          // without a cast, the way dispute-resolution.test.ts does it.
          if (e instanceof Error && 'code' in e && e.code === '55P03') return 'blocked'
          throw e // anything else is a broken test, not a blocked write
        }
      }

      // Control first: unlocked, the very same insert must succeed. Without it a
      // typo in the INSERT would look exactly like a working lock.
      assert.strictEqual(await insertEscrow(writer), 'ok', 'control insert should succeed')

      let release = (): void => {}
      const held = new Promise<void>((r) => (release = r))
      let locked = (): void => {}
      let lockFailed = (_e: unknown): void => {}
      const isLocked = new Promise<void>((res, rej) => {
        locked = res
        lockFailed = rej
      })

      // If the lock query itself fails, reject `isLocked` rather than leaving
      // the await below hanging forever on a signal that will never come.
      const tx = drizzle(holder)
        .transaction(async (t) => {
          await lockChainsForRetirement(t, [CHAIN])
          locked()
          await held
        })
        .catch((e) => lockFailed(e))

      await isLocked
      // The transaction MUST be released before asserting: an assertion throw
      // between here and `release()` leaves it open, and `holder.end()` in the
      // finally then waits on it forever — turning a failing test into a hung
      // suite. (Observed: the first version of this test hung a mutation run.)
      let outcome: 'ok' | 'blocked'
      try {
        outcome = await insertEscrow(writer)
      } finally {
        release()
        await tx
      }
      assert.strictEqual(
        outcome,
        'blocked',
        'escrow creation on a retiring chain must wait for the seed transaction',
      )
    } finally {
      await dropProbeChain(setup, CHAIN)
      await setup`delete from assets where id = ${ASSET}`
      await Promise.all([holder.end(), writer.end(), setup.end()])
    }
  },
)

test('a chain with no unsettled escrows retires without an override', { skip }, async () => {
  const url = process.env.TEST_DATABASE_URL!
  const sql = postgres(url, { max: 1 })
  const db = drizzle(sql)
  const CHAIN = 'eip155:999997'
  try {
    // Enabled, unconfigured, but nothing left to strand.
    await seedProbeChain(sql, CHAIN, { withUnsettledEscrow: false })

    await withEnv({ SEED_ON_BOOT: 'true' }, async () => {
      await seedOnBoot(log, url)
    })

    const [row] = await db.select().from(chains).where(eq(chains.id, CHAIN))
    assert.strictEqual(row?.is_enabled, false, 'a finished chain should retire freely')
  } finally {
    await dropProbeChain(sql, CHAIN)
    await sql.end()
  }
})
