/**
 * CLI for the design-token generator — the single source of truth is
 * apps/mobile/theme/tokens.ts (master-plan decision #9). Never hand-edit the
 * output; change the mobile tokens and regenerate.
 *
 *   pnpm --filter web gen:tokens          # write styles/tokens.css
 *   pnpm --filter web gen:tokens:check    # exit 1 if regenerating would diff (CI)
 *
 * Theme shape follows the ui-ux brief: full light palette on bare :root,
 * system dark behind prefers-color-scheme guarded by :root:not([data-theme=
 * "light"]), and an explicit :root[data-theme="dark"] block so a toggle wins
 * in both directions.
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { render } from './core'

const OUT_PATH = join(dirname(fileURLToPath(import.meta.url)), '../../styles/tokens.css')

const css = render()
if (process.argv.includes('--check')) {
  let existing = ''
  try {
    existing = readFileSync(OUT_PATH, 'utf8')
  } catch {
    console.error(`tokens check: ${OUT_PATH} is missing — run gen:tokens`)
    process.exit(1)
  }
  if (existing !== css) {
    console.error('tokens check: styles/tokens.css is stale — run gen:tokens and commit the diff')
    process.exit(1)
  }
  console.log('tokens check: styles/tokens.css is up to date')
} else {
  mkdirSync(dirname(OUT_PATH), { recursive: true })
  writeFileSync(OUT_PATH, css)
  console.log(`wrote ${OUT_PATH}`)
}
