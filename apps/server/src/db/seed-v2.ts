/**
 * Cutover seeds: chains, assets, platform_config. Idempotent by construction,
 * registry FACTS (chain/asset rows) upsert so a redeploy or manifest change
 * propagates on re-run; operator-tunable rows (platform_config,
 * fiat_providers) stay `ON CONFLICT DO NOTHING` so re-seeding never clobbers
 * admin edits. Boot-time invocation is safe.
 *
 * Run: `pnpm --filter tenda-server db:seed` (requires DATABASE_URL +
 * `CHAIN_<ID>_*` env). Fully manifest + secrets driven, nothing chain-shaped
 * is hardcoded here:
 *   - which chains  ← the ACTIVE chain secrets (chains/secrets.ts)
 *   - display/confirmations/token addresses ← the shared CHAIN_MANIFEST
 *   - solana escrow program id ← @tenda/shared/idl (the deployed artifact)
 *   - EVM escrow + treasury    ← the chain's secrets
 *   - solana USDC mint         ← the chain's secret (`fromSecret`); skipped + warned if unset
 *   - gas-seed columns ← manifest `gasSeedAmountRaw` + the funder address DERIVED
 *     from the chain's hot-wallet secret; both stay NULL until BOTH exist (#40),
 *     the paired CHECK constraint requires both-or-neither.
 */

import 'dotenv/config'
import postgres from 'postgres'
import { drizzle, type PostgresJsDatabase } from 'drizzle-orm/postgres-js'
import { inArray, notInArray, sql } from 'drizzle-orm'
import { ESCROW_IDL } from '@tenda/shared/idl'
import { assets, chains } from '@tenda/shared/db/schema/chains'
import { fiat_providers } from '@tenda/shared/db/schema/fiat'
import { ASSET_META, chainById, type ChainAsset } from '@tenda/shared'
import { platform_config } from '@tenda/shared/db/schema/governance'
import { loadConfig } from '@server/config'
import { getChainSecrets, type ResolvedChainSecret } from '@server/chains/secrets'
import { gasSeedAddressFromSecret } from '@server/chains/solana/gas-seed-sender'
import {
  P2P_INTERNAL_ID,
  P2P_INTERNAL_CAPABILITIES,
  YELLOWCARD_SPEC,
  ONRAMPMONEY_SPEC,
} from '@server/features/fiat-rails'

// ---------- pure row builder (unit-tested) ---------------------------------

type ChainRow = typeof chains.$inferInsert
type AssetRow = typeof assets.$inferInsert

export interface FiatProviderRow {
  id: string
  display_name: string
  capabilities: { onramp: boolean; offramp: boolean; currencies: string[]; assets: string[] }
  priority: number
  is_enabled: boolean
}

export interface SeedRows {
  chains: ChainRow[]
  assets: AssetRow[]
  fiat_providers: FiatProviderRow[]
  /** Assets skipped because their config inputs are missing. */
  skipped: string[]
}

/**
 * Resolve an asset's seedable token address. A `fromSecret` asset (Solana USDC
 *, the mint differs per cluster and is not canonical) is supplied by the
 * chain's secret and skipped when absent; otherwise the manifest token (canonical
 * EVM contract) or `null` (native) is used.
 */
function resolveAssetToken(
  asset: ChainAsset,
  secret: ResolvedChainSecret,
): { token: string | null; skip: boolean } {
  if (asset.fromSecret === undefined) return { token: asset.token, skip: false }
  if (secret.namespace === 'solana' && asset.fromSecret === 'usdcMint') {
    return secret.usdcMint !== undefined
      ? { token: secret.usdcMint, skip: false }
      : { token: null, skip: true }
  }
  return { token: null, skip: true }
}

/**
 * The paired gas-seed columns for a chain. Both are set only when the manifest
 * declares a seed amount AND the deployment configured the hot-wallet secret
 * that funds it — otherwise both stay NULL, keeping the chain's seed dormant and
 * satisfying the `chains_gas_seed_paired_chk` (both-or-neither) constraint. The
 * funder address is DERIVED from the same secret the sender signs with (no drift).
 */
function resolveGasSeed(
  amount_raw: string | undefined,
  secret: ResolvedChainSecret,
): { amount_raw: string | null; wallet_address: string | null } {
  const key = secret.namespace === 'solana' ? secret.gasSeedKey : undefined
  if (amount_raw === undefined || key === undefined) {
    return { amount_raw: null, wallet_address: null }
  }
  return { amount_raw, wallet_address: gasSeedAddressFromSecret(key) }
}

export function buildSeedRows(secrets: ReadonlyMap<string, ResolvedChainSecret>): SeedRows {
  const chainRows: ChainRow[] = []
  const assetRows: AssetRow[] = []
  const skipped: string[] = []

  // symbol/decimals/is_stable come from the shared ASSET_META registry,
  // the seed only contributes the deployment-specific chain/token wiring.
  function assetRow(id: string, chain_id: string, token_address: string | null): AssetRow {
    const meta = ASSET_META[id]
    if (meta === undefined) throw new Error(`asset '${id}' missing from shared ASSET_META`)
    return { id, chain_id, symbol: meta.symbol, decimals: meta.decimals, token_address, is_stable: meta.is_stable }
  }

  // One row set per ACTIVE chain. Solana's escrow program id is the deployed
  // IDL artifact (single source); EVM's is the deployed contract from secrets.
  for (const secret of secrets.values()) {
    const entry = chainById(secret.chainId)
    const gasSeed = resolveGasSeed(entry.gasSeedAmountRaw, secret)
    chainRows.push({
      id: entry.id,
      namespace: entry.namespace,
      display_name: entry.displayName,
      min_confirmations: entry.minConfirmations,
      treasury_address: secret.treasury,
      escrow_program: secret.namespace === 'solana' ? ESCROW_IDL.address : secret.escrow,
      gas_seed_amount_raw: gasSeed.amount_raw,
      gas_seed_wallet_address: gasSeed.wallet_address,
    })
    for (const asset of entry.assets) {
      const resolved = resolveAssetToken(asset, secret)
      if (resolved.skip) {
        skipped.push(`${asset.id} on ${entry.id} (${asset.fromSecret} not configured)`)
        continue
      }
      assetRows.push(assetRow(asset.id, entry.id, resolved.token))
    }
  }

  // Stage 8: routing registry (enable/priority only, credentials live in
  // env; a provider without keys is simply never constructed).
  // Capabilities are single-sourced from the provider definitions (licensed
  // specs + the derived p2p surface) so this admin-visible row can't drift from
  // the live routing. Only priority/enablement are seed-tunable defaults.
  const fiatProviderRows: FiatProviderRow[] = [
    {
      id: YELLOWCARD_SPEC.id,
      display_name: 'Yellow Card',
      capabilities: YELLOWCARD_SPEC.capabilities,
      priority: 10,
      is_enabled: true,
    },
    {
      id: ONRAMPMONEY_SPEC.id,
      display_name: 'Onramp.money',
      capabilities: ONRAMPMONEY_SPEC.capabilities,
      priority: 20,
      is_enabled: true,
    },
    {
      id: P2P_INTERNAL_ID,
      display_name: 'Tenda P2P',
      capabilities: P2P_INTERNAL_CAPABILITIES,
      priority: 100,
      is_enabled: true,
    },
  ]

  return { chains: chainRows, assets: assetRows, fiat_providers: fiatProviderRows, skipped }
}

// ---------- I/O wrapper ------------------------------------------------------

/**
 * Apply seed rows to a database (exported for the DB-backed upsert test).
 * Registry facts follow config; operator-tunable rows are ensure-only.
 */
export async function applySeed(db: PostgresJsDatabase, rows: SeedRows): Promise<void> {
  // Registry facts follow config: a contract redeploy or manifest change must
  // land on re-seed (a DO NOTHING here once stranded a stale escrow address
  // after the Base Sepolia redeploy). `is_enabled` is deliberately NOT in the
  // update set, the reconcile below owns it.
  await db.insert(chains).values(rows.chains).onConflictDoUpdate({
    target: chains.id,
    set: {
      namespace: sql`excluded.namespace`,
      display_name: sql`excluded.display_name`,
      min_confirmations: sql`excluded.min_confirmations`,
      treasury_address: sql`excluded.treasury_address`,
      escrow_program: sql`excluded.escrow_program`,
      gas_seed_amount_raw: sql`excluded.gas_seed_amount_raw`,
      gas_seed_wallet_address: sql`excluded.gas_seed_wallet_address`,
    },
  })
  await db.insert(assets).values(rows.assets).onConflictDoUpdate({
    target: assets.id,
    set: {
      chain_id: sql`excluded.chain_id`,
      symbol: sql`excluded.symbol`,
      decimals: sql`excluded.decimals`,
      token_address: sql`excluded.token_address`,
      is_stable: sql`excluded.is_stable`,
    },
  })
  await db.insert(platform_config).values({ id: 1 }).onConflictDoNothing({
    target: platform_config.id,
  })
  await db
    .insert(fiat_providers)
    .values(rows.fiat_providers)
    .onConflictDoNothing({ target: fiat_providers.id })

  // Reconcile enablement so the registry reflects EXACTLY the active config
  // (one chain per family). The seed never deletes, so a chain/asset from a
  // prior env (e.g. a switched-out Solana cluster) would otherwise linger
  // enabled and get served by /v1/platform/chains, surfacing as a duplicate
  // row on the wallet screen. Enable the active set, disable everything else.
  const activeChainIds = rows.chains.map((c) => c.id)
  const activeAssetIds = rows.assets.map((a) => a.id)
  await db.update(chains).set({ is_enabled: true }).where(inArray(chains.id, activeChainIds))
  await db.update(chains).set({ is_enabled: false }).where(notInArray(chains.id, activeChainIds))
  await db.update(assets).set({ is_enabled: true }).where(inArray(assets.id, activeAssetIds))
  await db.update(assets).set({ is_enabled: false }).where(notInArray(assets.id, activeAssetIds))
}

async function seed(): Promise<void> {
  const config = loadConfig()
  const rows = buildSeedRows(getChainSecrets())

  // NB: the client is not named `sql`, that would shadow drizzle's sql``
  // template used in applySeed's upsert sets (a shadowed call executes a
  // query and stringifies the Promise into the parameter).
  const client = postgres(config.DATABASE_URL, { max: 1 })
  try {
    await applySeed(drizzle(client), rows)

    console.log(
      `seed-v2: ${rows.chains.length} chains, ${rows.assets.length} assets, ` +
        `${rows.fiat_providers.length} fiat providers, platform_config ensured; ` +
        `enablement reconciled to active set`,
    )
    for (const s of rows.skipped) console.warn(`seed-v2: skipped ${s}`)
  } finally {
    await client.end()
  }
}

// Execute only when run directly (tsx src/db/seed-v2.ts), not on import.
if (require.main === module) {
  seed().catch((err) => {
    console.error('seed-v2 failed:', err)
    process.exitCode = 1
  })
}
