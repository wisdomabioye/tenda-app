/**
 * HTTP integration harness (CO2): a real Fastify app — real db/auth/queue
 * plugins, real autoloaded routes, the production error envelope — with
 * ONE substitution: a fake chain registry, so no test ever depends on
 * devnet RPC.
 *
 * GATED on TEST_DATABASE_URL (a dedicated database, e.g. tenda_test):
 *
 *   TEST_DATABASE_URL=postgresql://...:5432/tenda_test pnpm test
 *
 * Migrations run once per process via the drizzle programmatic migrator;
 * `resetDb()` truncates every public table between tests (the migrator's
 * bookkeeping lives in the `drizzle` schema and survives).
 */

// Env stubs BEFORE any config-reading import (CJS: imports execute in order).
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL ?? 'postgres://unused/test'
process.env.JWT_SECRET ??= 'test-secret'
process.env.CLOUDINARY_CLOUD_NAME ??= 'test-cloud'
process.env.CLOUDINARY_API_KEY ??= 'test-key'
process.env.CLOUDINARY_API_SECRET ??= 'test-secret-cl'
process.env.SOLANA_RPC_URL ??= 'http://127.0.0.1:8899'
process.env.SOLANA_TREASURY_ADDRESS ??= '4Nd1mYvK4Pm1x2HCmzCx5GQDV9KbpMK128bxgL5dVDU1'
process.env.SOLANA_PROGRAM_ID ??= '7H6AAoghUCPAVA1WTEwpSmkiRfPHWrgFidZQPzbXzkes'
process.env.API_BASE_URL ??= 'https://api.tenda.test'
delete process.env.REDIS_URL // queue stays the 501 stub — no Redis dependency

import { join } from 'node:path'
import { before, after, beforeEach } from 'node:test'
import Fastify, { type FastifyInstance } from 'fastify'
import AutoLoad from '@fastify/autoload'
import postgres from 'postgres'
import { sql } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/postgres-js'
import { migrate } from 'drizzle-orm/postgres-js/migrator'
import { users, escrows, gig_details, chains, assets } from '@tenda/shared/db/schema'
import { registerErrorHandlers } from '@server/lib/http-errors'
import dbPlugin from '@server/plugins/db'
import authPlugin from '@server/plugins/auth'
import queuePlugin from '@server/plugins/queue'
import websocketPlugin from '@server/plugins/websocket'
import type { ChainAdapter, ChainRegistry, UnsignedTx } from '@server/chains/types'
import { userFixture, escrowFixture, type UserRow, type EscrowRow } from './fixtures'

export const TEST_DB_CONFIGURED = process.env.TEST_DATABASE_URL !== undefined

/**
 * Chain/asset every harness escrow rides on (re-seeded by `resetDb`).
 * USDC_SOL is the gig-eligible asset for solana:devnet (assertGigAsset).
 */
export const TEST_CHAIN_ID = 'solana:devnet'
export const TEST_ASSET = 'USDC_SOL'

/** Stable dummy unsigned tx — routes only relay it, never decode it. */
export const FAKE_UNSIGNED: UnsignedTx = {
  kind: 'solana-tx',
  tx_base64: Buffer.from('fake-tx').toString('base64'),
  recent_blockhash: 'FakeBlockhash1111111111111111111111111111111',
  last_valid_block_height: 1,
}

function fakeAdapter(chain_id: string): ChainAdapter {
  const unimplemented = (op: string) => () => {
    throw new Error(`fake adapter: ${op} not used by HTTP routes under test`)
  }
  return {
    namespace: 'solana',
    chain_id,
    buildTx: async () => FAKE_UNSIGNED,
    verifyTx: unimplemented('verifyTx'),
    verifyAuthSig: unimplemented('verifyAuthSig'),
    fetchEscrowState: unimplemented('fetchEscrowState'),
    computeFee: unimplemented('computeFee'),
  }
}

function fakeRegistry(): ChainRegistry {
  const adapters = new Map<string, ChainAdapter>([[TEST_CHAIN_ID, fakeAdapter(TEST_CHAIN_ID)]])
  return {
    get(chain_id) {
      const a = adapters.get(chain_id)
      if (a === undefined) throw new Error(`no adapter registered for chain_id '${chain_id}'`)
      return a
    },
    has: (chain_id) => adapters.has(chain_id),
    list: () => [...adapters.values()],
  }
}

let migrated = false

/** Bring the test DB to head over a dedicated quiet connection. */
async function migrateOnce(): Promise<void> {
  if (migrated) return
  const client = postgres(process.env.DATABASE_URL as string, { max: 1, onnotice: () => {} })
  await migrate(drizzle(client), {
    migrationsFolder: join(__dirname, '..', '..', 'src', 'db', 'migrations'),
  })
  await client.end()
  migrated = true
}

export async function buildTestApp(): Promise<FastifyInstance> {
  await migrateOnce()

  const app = Fastify({ logger: false })
  registerErrorHandlers(app)

  await app.register(dbPlugin)
  await app.register(authPlugin)
  await app.register(queuePlugin)
  await app.register(websocketPlugin)
  app.decorate('chains', fakeRegistry())

  await app.register(AutoLoad, {
    dir: join(__dirname, '..', '..', 'src', 'routes'),
    routeParams: true,
  })
  await app.ready()
  return app
}

/**
 * Suites run in sibling processes (node --test = one process per file,
 * concurrent) but share ONE test database — a session-scoped advisory lock
 * held for the file's whole run serializes them. Unit suites are untouched.
 */
const SUITE_LOCK_KEY = 813_370

/**
 * Per-suite boilerplate: takes the cross-process suite lock, boots the app
 * once, resets the DB before every test, releases on exit. Returns a getter
 * (the instance doesn't exist until the before hook runs). Pair with
 * `{ skip: !TEST_DB_CONFIGURED }` on each test.
 */
export function useTestApp(): () => FastifyInstance {
  let app: FastifyInstance
  let lock: postgres.Sql | null = null
  before(async () => {
    if (!TEST_DB_CONFIGURED) return
    lock = postgres(process.env.DATABASE_URL as string, { max: 1, onnotice: () => {} })
    await lock`SELECT pg_advisory_lock(${SUITE_LOCK_KEY})`
    app = await buildTestApp()
  })
  after(async () => {
    if (!TEST_DB_CONFIGURED) return
    await app.close()
    if (lock !== null) {
      await lock`SELECT pg_advisory_unlock(${SUITE_LOCK_KEY})`
      await lock.end()
    }
  })
  beforeEach(async () => {
    if (!TEST_DB_CONFIGURED) return
    await resetDb(app)
  })
  return () => app
}

/**
 * Truncate every public table (migrator bookkeeping lives in the `drizzle`
 * schema and survives), then re-seed the chain/asset rows escrow inserts
 * FK-reference. Call in beforeEach.
 */
export async function resetDb(app: FastifyInstance): Promise<void> {
  const tables = await app.db.execute<{ tablename: string }>(
    sql`SELECT tablename FROM pg_tables WHERE schemaname = 'public'`,
  )
  if (tables.length > 0) {
    const list = tables.map((t) => `"${t.tablename}"`).join(', ')
    await app.db.execute(sql.raw(`TRUNCATE ${list} RESTART IDENTITY CASCADE`))
  }
  await app.db.insert(chains).values({
    id: TEST_CHAIN_ID,
    namespace: 'solana',
    display_name: 'Solana Devnet',
    min_confirmations: 1,
    treasury_address: process.env.SOLANA_TREASURY_ADDRESS ?? '',
    escrow_program: process.env.SOLANA_PROGRAM_ID ?? '',
  })
  await app.db.insert(assets).values({
    id: TEST_ASSET,
    chain_id: TEST_CHAIN_ID,
    symbol: 'USDC',
    decimals: 6,
    token_address: '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU', // devnet USDC mint
    is_stable: true,
  })
}

// ---------- fixtures (DB-backed; object shapes come from ./fixtures) -------

export interface TestUser {
  row: UserRow
  token: string
}

export async function createUser(
  app: FastifyInstance,
  overrides: Partial<UserRow> = {},
): Promise<TestUser> {
  const row = userFixture(overrides)
  await app.db.insert(users).values(row)
  return { row, token: app.jwt.sign({ id: row.id, role: row.role }) }
}

/**
 * Insert an escrow on the harness chain/asset. accept_deadline defaults to
 * now+24h (the fixture's fixed date is fine for pure object tests but HTTP
 * listing filters compare against the real clock).
 */
export async function createEscrow(
  app: FastifyInstance,
  overrides: Partial<EscrowRow> & { creator_id: string },
): Promise<EscrowRow> {
  const row = escrowFixture({
    chain_id: TEST_CHAIN_ID,
    asset: TEST_ASSET,
    accept_deadline: new Date(Date.now() + 86_400_000),
    ...overrides,
  })
  await app.db.insert(escrows).values(row)
  return row
}

export interface GigDetailsOverrides {
  title?: string
  description?: string
  category?: string
  country?: string
  city?: string | null
  remote?: boolean
  cross_border?: boolean
}

export async function attachGigDetails(
  app: FastifyInstance,
  escrow_id: string,
  overrides: GigDetailsOverrides = {},
): Promise<void> {
  await app.db.insert(gig_details).values({
    escrow_id,
    title: 'Test gig',
    description: 'Test description',
    category: 'service',
    country: 'NG',
    city: 'Lagos',
    remote: false,
    cross_border: false,
    ...overrides,
  })
}

export function authHeader(token: string): { authorization: string } {
  return { authorization: `Bearer ${token}` }
}
