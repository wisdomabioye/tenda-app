#!/usr/bin/env node
/**
 * sync-idl.mjs
 *
 * Run after every `anchor build` to propagate the compiled IDL and TypeScript
 * types from the Anchor output into @tenda/shared, then rebuild the package.
 *
 * Usage:
 *   pnpm sync:idl
 */

import { copyFileSync, existsSync } from 'node:fs'
import { execSync } from 'node:child_process'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT    = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const ANCHOR  = resolve(ROOT, '../tenda-escrow')
const DEST    = resolve(ROOT, 'packages/shared/src/idl')

const SRC_JSON = resolve(ANCHOR, 'target/idl/tenda_escrow.json')
const SRC_TS   = resolve(ANCHOR, 'target/types/tenda_escrow.ts')
const DST_JSON = resolve(DEST, 'tenda_escrow.json')
const DST_TS   = resolve(DEST, 'tenda_escrow.ts')

if (!existsSync(SRC_JSON) || !existsSync(SRC_TS)) {
  console.error('Anchor build output not found. Run `anchor build` first.')
  console.error(`  Expected: ${SRC_JSON}`)
  console.error(`  Expected: ${SRC_TS}`)
  process.exit(1)
}

copyFileSync(SRC_JSON, DST_JSON)
console.log(`✓ Copied tenda_escrow.json → packages/shared/src/types/`)

copyFileSync(SRC_TS, DST_TS)
console.log(`✓ Copied tenda_escrow.ts  → packages/shared/src/types/`)

execSync('pnpm --filter @tenda/shared build', { stdio: 'inherit', cwd: ROOT })
console.log('✓ @tenda/shared rebuilt with new IDL')
