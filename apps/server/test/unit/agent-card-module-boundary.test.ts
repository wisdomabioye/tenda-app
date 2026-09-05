/**
 * The agent card stays REMOVABLE — a source scan over the property no
 * behavioural test can see, modelled on gas-seed-module-boundary.test.ts.
 *
 * The removal recipe in `features/agent-card/index.ts` promises that deleting
 * two directories and two test files removes the feature. That promise is only
 * true while nothing in `src/` reaches PAST the barrel: an import of
 * `features/agent-card/store` compiles, runs, passes every other test, and
 * quietly turns a two-directory delete into a hunt.
 *
 * It matters more here than for most features. #81 is scheduled to absorb this
 * directory into a general agent-identity seam, so "delete the folder" is not a
 * hypothetical tidiness claim — it is the migration that is already planned.
 *
 * Scanning `src/` only, deliberately: tests legitimately address internals the
 * barrel does not publish, and a rule forbidding that would push modules into
 * the public surface just to be testable, which is the opposite of the point.
 */

import { test } from 'node:test'
import assert from 'node:assert'
import { readFileSync } from 'node:fs'
import { join, relative } from 'node:path'
import { stripComments, tsFilesUnder } from '../helpers/source-scan'

const SRC = join(__dirname, '../../src')
const FEATURE_DIR = join(SRC, 'features/agent-card')

/**
 * Import specifiers naming the agent-card feature — both the `@server/...`
 * alias and a relative path, because the boundary is about the MODULE reached,
 * not how the author spelled the way there.
 */
function agentCardImports(source: string): string[] {
  // Comments stripped FIRST: this feature's own prose names its module paths
  // (the removal recipe lists them), and a scan that matched those would report
  // the documentation as the violation.
  const specifiers = [...stripComments(source).matchAll(/from\s+'([^']+)'/g)].map((m) => m[1])
  return specifiers.filter((s) => s !== undefined && s.includes('features/agent-card'))
}

function importersOutsideTheFeature(): string[] {
  return tsFilesUnder(SRC)
    .filter((file) => !file.startsWith(FEATURE_DIR))
    .filter((file) => agentCardImports(readFileSync(file, 'utf8')).length > 0)
    .map((file) => relative(SRC, file))
    .sort()
}

test('nothing in src/ reaches past the agent-card barrel', () => {
  const offenders: string[] = []
  for (const file of tsFilesUnder(SRC)) {
    if (file.startsWith(FEATURE_DIR)) continue // the feature's own internals
    for (const specifier of agentCardImports(readFileSync(file, 'utf8'))) {
      // The barrel, and only the barrel: '@server/features/agent-card' exactly.
      // Anything with a further segment is a reach past it.
      if (!/features\/agent-card$/.test(specifier)) {
        offenders.push(`${relative(SRC, file)} imports '${specifier}'`)
      }
    }
  }
  assert.deepStrictEqual(
    offenders,
    [],
    `these imports break the removal recipe — import the barrel instead:\n  ${offenders.join('\n  ')}`,
  )
})

test('the feature is reached from exactly ONE place, as the recipe says', () => {
  // The user's constraint for this task was a pluggable feature with a one-line
  // import and no clustering. That is a claim about the import graph, so this is
  // where it is actually enforced: a second importer has to be added here
  // deliberately and, at that moment, to the removal recipe as well.
  assert.deepStrictEqual(importersOutsideTheFeature(), ['routes/well-known/agents/index.ts'])
})

test('the scan can actually see an importer — it is not passing on an empty walk', () => {
  // A source scan that silently walked nothing would make both cases above pass
  // while asserting nothing. Two independent floors: the tree is substantial,
  // and the one importer above was really found by the same predicate.
  assert.ok(tsFilesUnder(SRC).length > 100, 'the source walk returned almost nothing')
  assert.strictEqual(importersOutsideTheFeature().length, 1)
})
