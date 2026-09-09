/**
 * No bracket read of the shared asset registry anywhere in this app's source.
 *
 * `ASSET_META[x]` on a plain object answers a truthy FUNCTION for a prototype
 * key ('toString', 'constructor', '__proto__'), so every `=== undefined` and
 * `?.field ?? fallback` written against it is a guard that never fires — the
 * class that printed 'NaN' for money (#33) and moderated a price at the wrong
 * decimals (#116). The registry has an accessor built on `Object.hasOwn`
 * (`getAssetMeta`) and a display helper on top of it (`assetSymbol`).
 *
 * Web has held its tree to them since #116; mobile had no such guard, which is
 * how `useModerationPreview` kept the last bracket read in either client
 * (#154). This is web's twin, deliberately the same shape: walk the source,
 * name the offenders, and keep NO register of exceptions — there is no
 * legitimate bracket read of this map.
 */
import { readdirSync, readFileSync } from 'node:fs'
import { join, relative } from 'node:path'

const ROOT = join(__dirname, '..', '..')
/** Every directory holding app source. `features/` is here and not in web's copy: mobile keeps removable feature folders (gas-claim, escrow-proofs) that read assets too. */
const ROOTS = ['app', 'components', 'lib', 'hooks', 'stores', 'wallet', 'features']
const BRACKET_READ = /\bASSET_META\s*\[/g
const ACCESSOR = /\b(getAssetMeta|assetSymbol)\b/
const SKIPPED = new Set(['__tests__', '__fixtures__', '__mocks__', 'node_modules'])

function sourceFiles(dir: string): string[] {
  const out: string[] = []
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) {
      if (SKIPPED.has(entry.name)) continue
      out.push(...sourceFiles(full))
    } else if (/\.(ts|tsx)$/.test(entry.name) && !entry.name.endsWith('.d.ts')) {
      out.push(full)
    }
  }
  return out
}

describe('asset registry access', () => {
  const files = ROOTS.flatMap((root) => sourceFiles(join(ROOT, root)))

  it('walks a real tree — a broken walk would pass every case below vacuously', () => {
    expect(files.length).toBeGreaterThan(100)
    const users = files.filter((file) => ACCESSOR.test(readFileSync(file, 'utf8')))
    expect(users.length).toBeGreaterThan(0)
  })

  it('searches for something real — a positive and a negative control on the pattern itself', () => {
    // A typo in the pattern would make the case below pass over a tree full of
    // bracket reads, and nothing else here would notice: the accessor case
    // above stays green either way. So the pattern is held to two samples.
    expect('const meta = ASSET_META[asset]'.match(BRACKET_READ)).toHaveLength(1)
    expect('const meta = getAssetMeta(asset)'.match(BRACKET_READ)).toBeNull()
  })

  it('reads ASSET_META only through its accessor — no bracket read in any source file', () => {
    const offenders = files
      .map((file) => ({
        file: relative(ROOT, file),
        hits: readFileSync(file, 'utf8').match(BRACKET_READ)?.length ?? 0,
      }))
      .filter(({ hits }) => hits > 0)
    // A list of files, not a count: a failure has to name where the bracket
    // came back.
    expect(offenders).toEqual([])
  })
})
