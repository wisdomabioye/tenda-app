/**
 * Drift guard for the @fastify/autoload index-file trap: a directory with an
 * index file gets ONLY that file loaded (plus its sub-directories), so a
 * sibling `.ts` is silently ignored unless the index does something with it.
 * This killed the whole /v1/admin/* surface once (#76), which is why the guard
 * exists at all.
 *
 * DERIVED, not listed. It walks `src/routes` for every directory that has an
 * index.ts AND at least one sibling .ts, so a directory that takes this shape
 * later is covered the day it appears — which matters, because the trap bites
 * whoever did not know about it. Four match today: admin, blockchain, gigs, and
 * webhooks, the last added by #106 (before it, webhooks had no index and its
 * bare helius.ts was mounted a level up from its documented path).
 *
 * THE RULE IS "the index MENTIONS it", not "the index registers it as a route",
 * because both kinds of sibling are legitimate: admin's, blockchain's and
 * webhooks' are route modules the index registers under a prefix, while gigs'
 * three are helpers the index imports and calls. What is NOT legitimate — and
 * what this fails on — is a sibling the index never names: autoload ignores it
 * and nothing imports it, so it is either dead code or a route serving nothing.
 *
 * It reads source text rather than importing anything: the question is whether
 * one file references another, and answering it by import would run every route
 * module for its side effects to learn something the text already says.
 */
import { test } from 'node:test'
import assert from 'node:assert'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

const ROUTES_DIR = join(__dirname, '..', '..', 'src', 'routes')

interface IndexBearingDir {
  /** Path relative to src/routes, for readable failures. */
  label: string
  index: string
  siblings: string[]
}

/** Every directory under src/routes with an index.ts and ≥1 sibling module. */
function indexBearingDirs(dir: string = ROUTES_DIR, label = ''): IndexBearingDir[] {
  const entries = readdirSync(dir)
  const found: IndexBearingDir[] = []

  // `.d.ts` is excluded rather than tolerated: it would arrive here as a
  // sibling called `foo.d` and demand an import nobody would ever write.
  const ts = entries.filter((e) => e.endsWith('.ts') && !e.endsWith('.d.ts'))
  const siblings = ts.filter((e) => e !== 'index.ts').map((e) => e.replace(/\.ts$/, ''))
  if (ts.includes('index.ts') && siblings.length > 0) {
    found.push({
      label: label === '' ? '.' : label,
      index: readFileSync(join(dir, 'index.ts'), 'utf8'),
      siblings,
    })
  }

  for (const entry of entries) {
    const child = join(dir, entry)
    if (!statSync(child).isDirectory()) continue
    found.push(...indexBearingDirs(child, label === '' ? entry : `${label}/${entry}`))
  }
  return found
}

test('every sibling of a route index.ts is named by that index', () => {
  const dirs = indexBearingDirs()

  // Non-vacuous: the directory whose loss motivated this guard must be in the
  // walk. Without it a broken walk would pass by finding nothing.
  assert.ok(
    dirs.some((d) => d.label === 'v1/admin' && d.siblings.length > 5),
    `the walk must reach v1/admin and its route modules; found: ${dirs.map((d) => d.label).join(', ')}`,
  )

  for (const { label, index, siblings } of dirs) {
    for (const name of siblings) {
      assert.ok(
        // Single quotes because that is what the linter enforces repo-wide; a
        // double-quoted import would be a lint failure before it got here.
        index.includes(`from './${name}'`),
        `${label}/${name}.ts is never named by ${label}/index.ts — @fastify/autoload loads ` +
          `ONLY the index from a directory that has one, so this file is unreachable: register ` +
          `it with a prefix if it is a route, import it if it is a helper, delete it if neither`,
      )
    }
  }
})
