/**
 * @vitest-environment node
 *
 * The coverage gate measures what the suite exercises.
 *
 * `coverage.include` is an allow-list, so a file outside it contributes nothing
 * to the reported figures even with a full suite. Nothing failed when that
 * happened — which is how nine route pages under app/(app)/ came to have real
 * cases whose subject could not move the number (#69, the web half of #58).
 *
 * These cases close that: a new suite on an unlisted module fails here, and the
 * register of deliberate exceptions cannot rot.
 *
 * #82 closed the OTHER half. A pattern naming a path that has moved gates
 * nothing and says nothing, so the code it named leaves the measurement in
 * silence — mobile had seven of those when #58 looked. One now fails here too.
 *
 * NODE environment, pinned above rather than worked around: this walks the app
 * tree and asks vitest's own coverage matcher about paths, and under the
 * project's default jsdom `test-exclude` trips jsdom's TextEncoder invariant
 * before a single case runs.
 */
import path from 'node:path'
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { collectTestSubjects } from '../test-support/coverage-subjects'
import { UNGATED_BUT_EXERCISED } from '../test-support/coverage-ungated'
import {
  SUITE_INCLUDE_PATTERN,
  configuredCoverageInclude,
  configuredSuiteInclude,
  gateMatcher,
  patternMatcher,
} from '../test-support/vitest-gate'

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const { sourceFiles, subjects, testFiles, unresolved } = collectTestSubjects(ROOT)
const isGated = gateMatcher(ROOT)
const registered = new Set(Object.keys(UNGATED_BUT_EXERCISED))

describe('coverage gate scope', () => {
  it('resolves a scope that is not empty — the check must not pass vacuously', () => {
    // Anchored on a module that must exist rather than on a count, which would
    // be a second thing to maintain. Without this the whole file could report
    // success having compared two empty sets.
    expect(testFiles.length).toBeGreaterThan(100)
    expect(subjects).toContain('hooks/gig/useModerationPreview.ts')
    // And the SCOPE itself, which this case was named for and did not check
    // (#82). Emptying `coverage.include` turned all nine cases in this file
    // green — measured, not reasoned about. The mechanism was measured too,
    // because the first guess at it was wrong: `test-exclude` does not fall back
    // to a `**` default, it resolves an empty list to `include: false` and drops
    // the include filter altogether (probed: `new TestExclude({ include: [] })`
    // reports `include === false` and instruments everything). So every file
    // reads as gated, every subject looks registered, and the inert-pattern
    // check below has nothing to iterate. A gate measuring everything and a gate
    // measuring nothing both pass; only this line tells them apart.
    expect(configuredCoverageInclude().length).toBeGreaterThan(0)
  })

  it('has no coverage.include pattern that instruments nothing', () => {
    // The OTHER half of "the gate cannot see it" (#82), and the half web had no
    // check for. A pattern naming a path that no longer exists gates nothing and
    // says nothing, so the code it named drops out of the measurement silently
    // when it moves. #58 found SEVEN of those on mobile, every one naming a
    // module that had gone to @tenda/shared with its pattern left behind;
    // deleting all seven changed the reported figures by nothing at all, which
    // is what proved they were dead.
    //
    // NO NEGATION FILTER, unlike mobile's version. jest's `collectCoverageFrom`
    // mixes positive globs and `!` exclusions in one list, so mobile has to skip
    // the latter — a defensive `!wallet/**/*.d.ts` legitimately matches nothing.
    // vitest keeps exclusions in a separate `coverage.exclude` array, so this
    // list is positive by construction (measured: 64 entries, zero starting with
    // `!`). Copying the filter across would be a guard no mutation could kill.
    //
    // NO VACUITY GUARD either, for the same reason and checked the same way: an
    // empty `sourceFiles` does not make this pass quietly, it makes EVERY
    // pattern look inert and the case fails naming all 64. Measured by stubbing
    // the resolver to return none. All 64 were alive when this landed — unlike
    // mobile, which had seven dead ones when #58 looked.
    const inert = configuredCoverageInclude().filter(
      (glob) => !sourceFiles.some(patternMatcher(ROOT, glob)),
    )
    expect(inert).toEqual([])
  })

  it('calls a pattern dead when its every match is EXCLUDED, not just when none exists', () => {
    // Why `patternMatcher` applies `coverage.exclude` alongside the single glob,
    // proved here rather than left as an unexercised design choice. The check
    // above asks "does this entry contribute anything to the gate", and an entry
    // matching only files the exclude list removes contributes nothing — it is
    // as dead as one naming a directory that has moved.
    //
    // `**/*.d.ts` is the case that exists to test it with: real files match it
    // (test-support/test-exclude.d.ts among them), and `coverage.exclude`
    // removes every one. Anchored on that first, so a repo with no .d.ts left
    // would fail here rather than pass on an empty `some`.
    expect(sourceFiles.some((file) => file.endsWith('.d.ts'))).toBe(true)
    expect(sourceFiles.some(patternMatcher(ROOT, '**/*.d.ts'))).toBe(false)
    // The positive half, so this cannot pass by patternMatcher answering false
    // to everything.
    expect(sourceFiles.some(patternMatcher(ROOT, 'lib/**/*.ts'))).toBe(true)
  })

  it('sees every module the suite exercises, or records it as a known exception', () => {
    const unregistered = subjects.filter((file) => !isGated(file) && !registered.has(file))
    expect(unregistered).toEqual([])
  })

  it('keeps no exception for a file that is now gated', () => {
    expect([...registered].filter((file) => isGated(file))).toEqual([])
  })

  it('keeps no exception for a file that no longer exists', () => {
    expect([...registered].filter((file) => !existsSync(path.join(ROOT, file)))).toEqual([])
  })

  it('keeps no exception for a file nothing exercises any more', () => {
    expect([...registered].filter((file) => !subjects.includes(file))).toEqual([])
  })

  it('gives every exception a REASON, not just an entry', () => {
    // Reported as the offending NAMES rather than a bare length assertion, so a
    // failure says which file is excused without saying why.
    const unexplained = Object.entries(UNGATED_BUT_EXERCISED)
      .filter(([, reason]) => reason.trim().length <= 20)
      .map(([file]) => file)
    expect(unexplained).toEqual([])
  })

  it('still matches the suite pattern the resolver assumes', () => {
    // The resolver walks `__tests__/**/*.test.{ts,tsx}` structurally rather than
    // through vitest's own matcher (tinyglobby, not cheaply importable here), so
    // the assumption is PINNED against the config. Change the pattern and this
    // fails loudly, instead of the resolver quietly reading the wrong file set.
    expect(configuredSuiteInclude()).toEqual([SUITE_INCLUDE_PATTERN])
  })

  it('resolves a subject for all but the suites that have none', () => {
    // Pinned, not counted: a suite the resolver cannot place is a suite whose
    // subject stays invisible to the gate, so the blind spot is bounded rather
    // than tolerated. Five of them assert CONTRACTS over a directory or a
    // config — a route manifest, a store-scope convention, two style contracts
    // and a wallet config guard — so there is no single module to name. Two
    // more are about the gate ITSELF: this file, whose subject is a config plus
    // the helpers beside it, and the resolver-parity suite (#77), whose subject
    // is the RELATIONSHIP between this app's resolver and mobile's. Naming any
    // one module for either would be a fiction.
    expect(unresolved).toEqual([
      '__tests__/coverage-gate.test.ts',
      '__tests__/coverage-resolver-parity.test.ts',
      'app/(public)/support/__tests__/support-routes.test.ts',
      'stores/__tests__/account-scope.guard.test.ts',
      'styles/__tests__/motion-contract.test.ts',
      'styles/__tests__/panes-contract.test.ts',
      'wallet/__tests__/config-guard.test.ts',
    ])
  })
})
