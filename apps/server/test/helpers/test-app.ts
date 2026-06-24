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
import { users, user_wallets, user_identities, escrows, gig_details, exchange_details, chains, assets } from '@tenda/shared/db/schema'
import { fiat_providers } from '@tenda/shared/db/schema/fiat'
import { registerErrorHandlers } from '@server/lib/http-errors'
import { invalidateFeaturedCache } from '@server/lib/featured'
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
export const TEST_NATIVE_ASSET = 'SOL_DEVNET'

/** Stable dummy unsigned tx — routes only relay it, never decode it. */
export const FAKE_UNSIGNED: UnsignedTx = {
  kind: 'solana-tx',
  tx_base64: Buffer.from('fake-tx').toString('base64'),
  recent_blockhash: 'FakeBlockhash1111111111111111111111111111111',
  last_valid_block_height: 1,
}

/**
 * Signature value the fake adapter treats as INVALID — lets wallet-auth
 * tests exercise the 401 path deterministically (every other signature
 * string verifies). Exported so tests reference the sentinel, not a literal.
 */
export const FAKE_BAD_SIGNATURE = 'sig:invalid'

function fakeAdapter(chain_id: string): ChainAdapter {
  const unimplemented = (op: string) => () => {
    throw new Error(`fake adapter: ${op} not used by HTTP routes under test`)
  }
  return {
    namespace: 'solana',
    chain_id,
    buildTx: async () => FAKE_UNSIGNED,
    verifyTx: unimplemented('verifyTx'),
    // Offline stand-in for tweetnacl/viem sig verify: any signature passes
    // except the explicit bad sentinel (the wallet-auth 401 path).
    verifyAuthSig: async ({ signature }) => signature !== FAKE_BAD_SIGNATURE,
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
    // Offline stand-in for tweetnacl/viem sig verify (namespace-dispatched, like
    // the real registry): any signature passes except the explicit bad sentinel
    // (the wallet-auth 401 path). Works for unprovisioned chains too.
    verifyAuthSig: async (_chain_id, { signature }) => signature !== FAKE_BAD_SIGNATURE,
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
    // `app` is undefined when before() failed — don't mask the root error.
    if (app !== undefined) await app.close()
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
  // Always-available fallback provider — fiat_intents.provider FKs it.
  await app.db.insert(fiat_providers).values({
    id: 'p2p_internal',
    display_name: 'Tenda P2P',
    capabilities: { onramp: true, offramp: true, currencies: ['NGN'], assets: ['SOL', 'SOL_DEVNET'] },
    priority: 100,
    is_enabled: true,
  })
  // In-process caches survive a TRUNCATE — drop them so a warmed rail
  // never leaks into the next test.
  invalidateFeaturedCache()
  await app.db.insert(chains).values({
    id: TEST_CHAIN_ID,
    namespace: 'solana',
    display_name: 'Solana Devnet',
    min_confirmations: 1,
    treasury_address: process.env.SOLANA_TREASURY_ADDRESS ?? '',
    escrow_program: process.env.SOLANA_PROGRAM_ID ?? '',
  })
  await app.db.insert(assets).values([
    {
      id: TEST_ASSET,
      chain_id: TEST_CHAIN_ID,
      symbol: 'USDC',
      decimals: 6,
      token_address: '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU', // devnet USDC mint
      is_stable: true,
    },
    // Native asset — the p2p exchange (CO4) trades SOL_DEVNET.
    {
      id: TEST_NATIVE_ASSET,
      chain_id: TEST_CHAIN_ID,
      symbol: 'SOL',
      decimals: 9,
      token_address: null,
      is_stable: false,
    },
  ])
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
 * Link a Solana wallet (matches TEST_CHAIN_ID's namespace) + a verified email
 * to a user so they clear the Stage-9D first-transaction gate
 * (`assertCanTransact`). The wallet address is derived from the user id so it
 * stays unique under the (chain_ns, address) constraint across many users.
 */
export async function makeTransactable(app: FastifyInstance, userId: string): Promise<void> {
  await app.db.insert(user_wallets).values({
    chain_ns: 'solana',
    address: `SoTx${userId.replace(/-/g, '')}`,
    user_id: userId,
    is_primary: true,
    verified_at: new Date(),
  })
  await app.db.insert(user_identities).values({
    user_id: userId,
    kind: 'email',
    identifier: `tx-${userId}@example.com`,
    email: `tx-${userId}@example.com`,
    verified_at: new Date(),
  })
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

export async function attachExchangeDetails(
  app: FastifyInstance,
  escrow_id: string,
  overrides: { fiat_amount?: string; fiat_currency?: string; rate?: string } = {},
): Promise<void> {
  await app.db.insert(exchange_details).values({
    escrow_id,
    fiat_amount: '15000.0000',
    fiat_currency: 'NGN',
    rate: '1500.0000000000',
    payment_window_seconds: 86_400,
    ...overrides,
  })
}

export function authHeader(token: string): { authorization: string } {
  return { authorization: `Bearer ${token}` }
}
