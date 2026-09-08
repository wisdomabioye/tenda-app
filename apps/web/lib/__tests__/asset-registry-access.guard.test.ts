/**
 * No bracket read of the shared asset registry anywhere in this app's source.
 *
 * `ASSET_META[x]` on a plain object answers a truthy FUNCTION for a prototype
 * key ('toString', 'constructor', '__proto__'), so every `=== undefined` and
 * `?.field ?? fallback` written against it is a guard that never fires — the
 * class that printed 'NaN' for money (#33) and would moderate a price at zero
 * decimals (#116). The registry has an accessor built on Object.hasOwn
 * (`getAssetMeta`) and a display helper on top of it (`assetSymbol`); this
 * holds every file in the tree to them, the way type-atoms.guard.test.ts
 * holds every file to the type scale. Same shape: walk the source, name the
 * offenders, no register of exceptions — there is no legitimate bracket read.
 */
import { readdirSync, readFileSync } from 'node:fs'
import { join, relative } from 'node:path'
import { describe, expect, it } from 'vitest'

const WEB_ROOT = `${process.cwd()}/`
const ROOTS = ['app', 'components', 'lib', 'hooks', 'stores', 'wallet']
const BRACKET_READ = /\bASSET_META\s*\[/g
const ACCESSOR = /\b(getAssetMeta|assetSymbol)\b/

function sourceFiles(dir: string): string[] {
  const out: string[] = []
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) {
      if (entry.name === '__tests__' || entry.name === '__fixtures__' || entry.name === 'node_modules') continue
      out.push(...sourceFiles(full))
    } else if (/\.(ts|tsx)$/.test(entry.name) && !entry.name.endsWith('.d.ts')) {
      out.push(full)
    }
  }
  return out
}

describe('asset registry access', () => {
  const files = ROOTS.flatMap((root) => sourceFiles(join(WEB_ROOT, root)))

  it('walks a real tree — the accessor is in use somewhere, so an empty result is not a broken glob', () => {
    const users = files.filter((file) => ACCESSOR.test(readFileSync(file, 'utf8')))
    expect(users.length).toBeGreaterThan(0)
  })

  it('reads ASSET_META only through its accessor — no bracket read in any source file', () => {
    const offenders = files
      .map((file) => ({ file: relative(WEB_ROOT, file), hits: readFileSync(file, 'utf8').match(BRACKET_READ)?.length ?? 0 }))
      .filter(({ hits }) => hits > 0)
    // Reported as a list of files, so a failure names where the bracket came
    // back rather than a bare count.
    expect(offenders).toEqual([])
  })
})
