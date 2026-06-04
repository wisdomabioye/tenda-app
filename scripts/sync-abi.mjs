#!/usr/bin/env node
/**
 * sync-abi.mjs
 *
 * Run after every `forge build` in tenda-escrow-evm to propagate the
 * compiled TendaEscrow ABI into @tenda/shared, then rebuild the package.
 *
 * Usage:
 *   node scripts/sync-abi.mjs
 */

import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { execSync } from 'node:child_process'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const ARTIFACT = resolve(ROOT, '../tenda-escrow-evm/out/TendaEscrow.sol/TendaEscrow.json')
const DEST = resolve(ROOT, 'packages/shared/src/abi/tenda_escrow_evm.json')

if (!existsSync(ARTIFACT)) {
  console.error(`✗ forge artifact missing: ${ARTIFACT}\n  Run \`forge build\` in tenda-escrow-evm first.`)
  process.exit(1)
}

const artifact = JSON.parse(readFileSync(ARTIFACT, 'utf8'))
writeFileSync(DEST, JSON.stringify({ contractName: 'TendaEscrow', abi: artifact.abi }, null, 2) + '\n')
console.log(`✓ ABI synced (${artifact.abi.length} entries) → ${DEST}`)

execSync('pnpm --filter @tenda/shared build', { cwd: ROOT, stdio: 'inherit' })
console.log('✓ @tenda/shared rebuilt with new ABI')
