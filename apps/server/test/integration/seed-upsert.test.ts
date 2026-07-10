/**
 * db/seed-v2.ts applySeed — registry facts UPSERT so a redeploy propagates on
 * re-seed (the pre-fix DO NOTHING stranded a stale escrow address in the dev
 * registry after the Base Sepolia redeploy), and enablement reconciles to the
 * active set. DB-backed, gated on TEST_DATABASE_URL; restores the registry
 * exactly as found (the suite shares this DB).
 */
import { test } from 'node:test'
import assert from 'node:assert'
import postgres from 'postgres'
import { drizzle, type PostgresJsDatabase } from 'drizzle-orm/postgres-js'
import { eq, inArray, notInArray } from 'drizzle-orm'
import { assets, chains } from '@tenda/shared/db/schema/chains'
import { TEST_DB_CONFIGURED, useSuiteLock } from '../helpers/test-app'
import { applySeed, buildSeedRows } from '@server/db/seed-v2'
import type { ResolvedChainSecret } from '@server/chains/secrets'

const skip = !TEST_DB_CONFIGURED

// This suite mutates the shared registry with its own client — hold the
// cross-process suite lock so a sibling harness TRUNCATE can't wipe it mid-run.
useSuiteLock()

const CHAIN_ID = 'eip155:84532'
const ESCROW_V1 = `0x${'11'.repeat(20)}`
const ESCROW_V2 = `0x${'22'.repeat(20)}`
const TREASURY = `0x${'33'.repeat(20)}`

function sepoliaSecrets(escrow: string): Map<string, ResolvedChainSecret> {
  return new Map<string, ResolvedChainSecret>([
    [
      CHAIN_ID,
      {
        namespace: 'eip155',
        chainId: CHAIN_ID,
        rpcUrl: 'http://127.0.0.1:59999',
        escrow,
        treasury: TREASURY,
      },
    ],
  ])
}

type ChainSnapshot = typeof chains.$inferSelect
type AssetSnapshot = typeof assets.$inferSelect

/** Put the registry back exactly as snapshotted: created rows deleted, pre-existing rows restored field-for-field. */
async function restoreRegistry(
  db: PostgresJsDatabase,
  chainRows: ChainSnapshot[],
  assetRows: AssetSnapshot[],
): Promise<void> {
  const assetIds = assetRows.map((a) => a.id)
  const chainIds = chainRows.map((c) => c.id)
  // assets first (FK on chain_id), then chains
  if (assetIds.length > 0) await db.delete(assets).where(notInArray(assets.id, assetIds))
  else await db.delete(assets)
  if (chainIds.length > 0) await db.delete(chains).where(notInArray(chains.id, chainIds))
  else await db.delete(chains)
  for (const row of chainRows) {
    await db.update(chains).set(row).where(eq(chains.id, row.id))
  }
  for (const row of assetRows) {
    await db.update(assets).set(row).where(eq(assets.id, row.id))
  }
}

test('applySeed: redeployed escrow address propagates on re-seed; reconcile owns enablement', { skip }, async () => {
  const client = postgres(process.env.DATABASE_URL as string, { max: 1 })
  const db = drizzle(client)
  try {
    const chainsBefore = await db.select().from(chains)
    const assetsBefore = await db.select().from(assets)
    try {
      // First deploy: rows land, active chain enabled.
      await applySeed(db, buildSeedRows(sepoliaSecrets(ESCROW_V1)))
      let [row] = await db
        .select({ escrow: chains.escrow_program, treasury: chains.treasury_address, enabled: chains.is_enabled })
        .from(chains)
        .where(eq(chains.id, CHAIN_ID))
      assert.equal(row?.escrow, ESCROW_V1)
      assert.equal(row?.treasury, TREASURY)
      assert.equal(row?.enabled, true)

      // Redeploy: same chain id, new contract — the FACT must follow config.
      // (Pre-fix DO NOTHING kept ESCROW_V1 here.)
      await applySeed(db, buildSeedRows(sepoliaSecrets(ESCROW_V2)))
      ;[row] = await db
        .select({ escrow: chains.escrow_program, treasury: chains.treasury_address, enabled: chains.is_enabled })
        .from(chains)
        .where(eq(chains.id, CHAIN_ID))
      assert.equal(row?.escrow, ESCROW_V2)

      // Assets upserted for the active chain (USDC token from the manifest).
      const assetRows = await db
        .select({ id: assets.id, token: assets.token_address, enabled: assets.is_enabled })
        .from(assets)
        .where(inArray(assets.id, ['USDC_BASE', 'ETH_BASE']))
      assert.equal(assetRows.length, 2)
      const usdc = assetRows.find((a) => a.id === 'USDC_BASE')
      assert.ok(usdc?.token?.startsWith('0x'), 'USDC token address seeded from manifest')

      // Reconcile: every chain outside the active set is now disabled.
      const others = await db
        .select({ id: chains.id, enabled: chains.is_enabled })
        .from(chains)
        .where(notInArray(chains.id, [CHAIN_ID]))
      for (const other of others) {
        assert.equal(other.enabled, false, `${other.id} should be disabled by the reconcile`)
      }
    } finally {
      await restoreRegistry(db, chainsBefore, assetsBefore)
    }
  } finally {
    await client.end()
  }
})
