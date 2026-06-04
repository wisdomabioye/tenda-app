/**
 * Stage-0 cutover seeds (cutover checklist §1): chains, assets,
 * platform_config. Idempotent by construction — every insert is
 * `ON CONFLICT DO NOTHING` (checklist §10.5), so re-runs are no-ops and
 * boot-time invocation is safe.
 *
 * Run: `pnpm --filter tenda-server db:seed` (requires DATABASE_URL +
 * SOLANA_* env). Values are config/IDL-driven — nothing chain-shaped is
 * hardcoded here:
 *   - escrow program id ← @tenda/shared/idl (the deployed artifact)
 *   - treasury           ← SOLANA_TREASURY_ADDRESS
 *   - USDC mint          ← SOLANA_USDC_MINT (asset skipped + warned if unset)
 *   - gas-seed columns stay NULL until the hot wallet exists (#40); the
 *     paired CHECK constraint requires both-or-neither.
 *
 * BASE/CELO rows land in Stages 3/4 by extending `buildSeedRows`.
 */

import 'dotenv/config'
import postgres from 'postgres'
import { drizzle } from 'drizzle-orm/postgres-js'
import { ESCROW_IDL } from '@tenda/shared/idl'
import { assets, chains } from '@tenda/shared/db/schema/chains'
import { fiat_providers } from '@tenda/shared/db/schema/fiat'
import { CELO_CUSD_ADDR, CELO_USDC_ADDR } from '@server/chains/celo/config'
import { ASSET_META } from '@tenda/shared'
import { platform_config } from '@tenda/shared/db/schema/governance'
import { loadConfig, type Config } from '@server/config'

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

export function buildSeedRows(
  config: Pick<
    Config,
    | 'SOLANA_TREASURY_ADDRESS'
    | 'SOLANA_USDC_MINT'
    | 'BASE_ESCROW_ADDR'
    | 'BASE_USDC_ADDR'
    | 'MULTISIG_BASE_ADDR'
    | 'CELO_ESCROW_ADDR'
    | 'MULTISIG_CELO_ADDR'
  >,
  /** Network this deployment targets — the USDC mint belongs to it. */
  active_chain_id: 'solana:mainnet' | 'solana:devnet',
): SeedRows {
  const escrow_program = ESCROW_IDL.address
  const chainRows: ChainRow[] = [
    {
      id: 'solana:mainnet',
      namespace: 'solana',
      display_name: 'Solana',
      min_confirmations: 1,
      treasury_address: config.SOLANA_TREASURY_ADDRESS,
      escrow_program,
    },
    {
      id: 'solana:devnet',
      namespace: 'solana',
      display_name: 'Solana Devnet',
      min_confirmations: 1,
      treasury_address: config.SOLANA_TREASURY_ADDRESS,
      escrow_program,
    },
  ]

  const assetRows: AssetRow[] = []
  const skipped: string[] = []

  // symbol/decimals/is_stable come from the shared ASSET_META registry —
  // the seed only contributes the deployment-specific chain/token wiring.
  function assetRow(id: string, chain_id: string, token_address: string | null): AssetRow {
    const meta = ASSET_META[id]
    if (meta === undefined) throw new Error(`asset '${id}' missing from shared ASSET_META`)
    return { id, chain_id, symbol: meta.symbol, decimals: meta.decimals, token_address, is_stable: meta.is_stable }
  }
  for (const chain of chainRows) {
    assetRows.push(assetRow(chain.id === 'solana:mainnet' ? 'SOL' : 'SOL_DEVNET', chain.id, null))
  }
  if (config.SOLANA_USDC_MINT !== null) {
    // The mint differs per network — the configured value belongs to the
    // network this deployment targets, so only that side gets the row.
    assetRows.push(assetRow('USDC_SOL', active_chain_id, config.SOLANA_USDC_MINT))
  } else {
    skipped.push('USDC_SOL (SOLANA_USDC_MINT not set)')
  }

  // Stage 3: BASE — rows land only when the deployment configures the
  // contract (#47 externals). ETH_BASE is exchange-only by server policy.
  // typeof guards (not !== null): a partial config object that omits the
  // BASE keys entirely must read as "unset", same as env-null.
  const baseEscrow = typeof config.BASE_ESCROW_ADDR === 'string' ? config.BASE_ESCROW_ADDR : null
  const baseMultisig = typeof config.MULTISIG_BASE_ADDR === 'string' ? config.MULTISIG_BASE_ADDR : null
  if ((baseEscrow === null) !== (baseMultisig === null)) {
    // Half-configured is a misconfiguration — warn; fully unset is the
    // normal pre-#47 state and stays silent.
    skipped.push('BASE chain (BASE_ESCROW_ADDR and MULTISIG_BASE_ADDR must both be set)')
  }
  if (baseEscrow !== null && baseMultisig !== null) {
    chainRows.push({
      id: 'eip155:8453',
      namespace: 'eip155',
      display_name: 'BASE',
      min_confirmations: 5,
      treasury_address: baseMultisig,
      escrow_program: baseEscrow,
    })
    if (typeof config.BASE_USDC_ADDR === 'string') {
      assetRows.push(assetRow('USDC_BASE', 'eip155:8453', config.BASE_USDC_ADDR))
    } else {
      skipped.push('USDC_BASE (BASE_USDC_ADDR not set)')
    }
    assetRows.push(assetRow('ETH_BASE', 'eip155:8453', null))
  }

  // Stage 4: CELO — same gating semantics as BASE; token addresses are
  // canonical mainnet constants (chains/celo/config.ts).
  const celoEscrow = typeof config.CELO_ESCROW_ADDR === 'string' ? config.CELO_ESCROW_ADDR : null
  const celoMultisig = typeof config.MULTISIG_CELO_ADDR === 'string' ? config.MULTISIG_CELO_ADDR : null
  if ((celoEscrow === null) !== (celoMultisig === null)) {
    skipped.push('CELO chain (CELO_ESCROW_ADDR and MULTISIG_CELO_ADDR must both be set)')
  }
  if (celoEscrow !== null && celoMultisig !== null) {
    chainRows.push({
      id: 'eip155:42220',
      namespace: 'eip155',
      display_name: 'CELO',
      min_confirmations: 3,
      treasury_address: celoMultisig,
      escrow_program: celoEscrow,
    })
    assetRows.push(
      assetRow('cUSD', 'eip155:42220', CELO_CUSD_ADDR),
      assetRow('USDC_CELO', 'eip155:42220', CELO_USDC_ADDR),
      assetRow('CELO', 'eip155:42220', null),
    )
  }

  // Stage 8: routing registry (enable/priority only — credentials live in
  // env; a provider without keys is simply never constructed).
  const fiatProviderRows: FiatProviderRow[] = [
    {
      id: 'yellowcard',
      display_name: 'Yellow Card',
      capabilities: { onramp: true, offramp: true, currencies: ['NGN'], assets: ['USDC_SOL', 'USDC_BASE'] },
      priority: 10,
      is_enabled: true,
    },
    {
      id: 'onrampmoney',
      display_name: 'Onramp.money',
      capabilities: { onramp: true, offramp: false, currencies: ['NGN'], assets: ['USDC_SOL', 'USDC_BASE'] },
      priority: 20,
      is_enabled: true,
    },
    {
      id: 'p2p_internal',
      display_name: 'Tenda P2P',
      capabilities: { onramp: false, offramp: true, currencies: ['NGN'], assets: ['SOL', 'SOL_DEVNET'] },
      priority: 100,
      is_enabled: true,
    },
  ]

  return { chains: chainRows, assets: assetRows, fiat_providers: fiatProviderRows, skipped }
}

// ---------- I/O wrapper ------------------------------------------------------

async function seed(): Promise<void> {
  const config = loadConfig()
  const activeChainId =
    config.SOLANA_NETWORK === 'mainnet-beta' ? 'solana:mainnet' : 'solana:devnet'
  const rows = buildSeedRows(config, activeChainId)

  const sql = postgres(config.DATABASE_URL, { max: 1 })
  const db = drizzle(sql)
  try {
    await db.insert(chains).values(rows.chains).onConflictDoNothing({ target: chains.id })
    await db.insert(assets).values(rows.assets).onConflictDoNothing({ target: assets.id })
    await db.insert(platform_config).values({ id: 1 }).onConflictDoNothing({
      target: platform_config.id,
    })
    await db
      .insert(fiat_providers)
      .values(rows.fiat_providers)
      .onConflictDoNothing({ target: fiat_providers.id })
    console.log(
      `seed-v2: ${rows.chains.length} chains, ${rows.assets.length} assets, ` +
        `${rows.fiat_providers.length} fiat providers, platform_config ensured`,
    )
    for (const s of rows.skipped) console.warn(`seed-v2: skipped ${s}`)
  } finally {
    await sql.end()
  }
}

// Execute only when run directly (tsx src/db/seed-v2.ts), not on import.
if (require.main === module) {
  seed().catch((err) => {
    console.error('seed-v2 failed:', err)
    process.exitCode = 1
  })
}
