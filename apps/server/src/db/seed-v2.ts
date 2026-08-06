/**
 * Cutover seed CLI: chains, assets, platform_config. Idempotent by
 * construction, so boot-time invocation (lib/boot-seed.ts) is safe.
 *
 * Run: `pnpm --filter tenda-server db:seed` (requires DATABASE_URL +
 * `CHAIN_<ID>_*` env).
 *
 * The work itself lives in ./seed:
 *   - ./seed/rows  — the pure, manifest + secrets driven row builder
 *   - ./seed/apply — the transactional applier and enablement reconcile
 *
 * Re-exported here so `@server/db/seed-v2` stays the import path.
 */

import 'dotenv/config'
import postgres from 'postgres'
import { drizzle } from 'drizzle-orm/postgres-js'
import { loadConfig } from '@server/config'
import { getChainSecrets } from '@server/chains/secrets'
import { buildSeedRows } from './seed/rows'
import { applySeed } from './seed/apply'

export { buildSeedRows } from './seed/rows'
export type { SeedRows, FiatProviderRow } from './seed/rows'
export { applySeed, applySeedRows, enablementDelta } from './seed/apply'
export type { EnablementDelta } from './seed/apply'

async function seed(): Promise<void> {
  const config = loadConfig()
  const rows = buildSeedRows(getChainSecrets())

  // NB: the client is not named `sql`, that would shadow drizzle's sql``
  // template used in the applier's upsert sets (a shadowed call executes a
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
