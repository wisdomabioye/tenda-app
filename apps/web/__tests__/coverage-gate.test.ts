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
  configuredSuiteInclude,
  gateMatcher,
} from '../test-support/vitest-gate'

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const { subjects, testFiles, unresolved } = collectTestSubjects(ROOT)
const isGated = gateMatcher(ROOT)
const registered = new Set(Object.keys(UNGATED_BUT_EXERCISED))

describe('coverage gate scope', () => {
  it('resolves a scope that is not empty — the check must not pass vacuously', () => {
    // Anchored on a module that must exist rather than on a count, which would
    // be a second thing to maintain. Without this the whole file could report
    // success having compared two empty sets.
    expect(testFiles.length).toBeGreaterThan(100)
    expect(subjects).toContain('hooks/gig/useModerationPreview.ts')
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
