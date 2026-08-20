/**
 * The coverage gate must be able to SEE every file the suite exercises.
 *
 * `collectCoverageFrom` is an allow-list, so an unlisted file contributes
 * nothing to the global figures however well tested it is, and nothing fails
 * when that happens — the number simply describes a smaller app. #49, #51 and
 * #56 each caught one of those by accident, which is not a process.
 *
 * These cases close it: a subject is either inside the gate or recorded in
 * UNGATED_WITH_TESTS, and a recorded entry that has since been gated has to be
 * removed. The register can still grow — but only in a diff someone reads,
 * never by a suite quietly landing on an unlisted file.
 *
 * This file and its resolver exempt themselves, and should: a suite directly
 * under the app root resolves to no subject at all, so `test-support/` is
 * never asked to be gated. It is harness code in the same sense jest.setup.js
 * is — not shipped, and covered by __tests__/coverage-subjects.test.ts rather
 * than by the app's instrumentation.
 */
import fs from 'node:fs'
import path from 'node:path'
import { globsToMatcher } from 'jest-util'
import config from '../jest.config'
import { collectTestSubjects } from '@/test-support/coverage-subjects'
import { UNGATED_WITH_TESTS } from '@/test-support/coverage-ungated'

const ROOT = path.join(__dirname, '..')

// The same function jest uses: @jest/transform's shouldInstrument matches
// collectCoverageFrom with globsToMatcher(...) over rootDir-relative paths. A
// lookalike matcher here could disagree with the real gate, which is precisely
// the failure this file exists to prevent.
const scope = config.collectCoverageFrom ?? []
const isGated = globsToMatcher(scope)

const { subjects, sourceFiles, testFiles, unresolved } = collectTestSubjects(ROOT)
const registered = new Set(UNGATED_WITH_TESTS)

describe('coverage gate scope', () => {
  it('is configured at all — an empty scope would gate nothing and pass everything', () => {
    expect(scope.length).toBeGreaterThan(0)
    expect(testFiles.length).toBeGreaterThan(0)
  })

  it('has no scope pattern that matches nothing', () => {
    // The other half of "the gate cannot see it": a pattern for a path that no
    // longer exists gates nothing and says nothing, so the code it named drops
    // out of the measurement silently when it moves. #48 hit this on web with
    // a Next dynamic segment read as a glob class; #58 found seven here, and
    // every one of them named a module that had moved into @tenda/shared —
    // 623a79c and 686cb76 — with its pattern left behind. Deleting all seven
    // changed the reported figures by nothing at all, which is the proof they
    // were dead.
    //
    // Positive patterns only. A NEGATION that matches nothing is defensive
    // rather than broken — `!wallet/**/*.d.ts` excludes generated typings that
    // are simply absent today — so requiring those to match would be wrong.
    const inert = scope
      .filter((glob) => !glob.startsWith('!'))
      .filter((glob) => !sourceFiles.some(globsToMatcher([glob])))
    expect(inert).toEqual([])
  })

  it('sees every module the suite exercises, or records it as a known exception', () => {
    const unregistered = subjects.filter((file) => !isGated(file) && !registered.has(file))
    expect(unregistered).toEqual([])
  })

  it('keeps no exception for a file that is now gated', () => {
    const stale = UNGATED_WITH_TESTS.filter((file) => isGated(file))
    expect(stale).toEqual([])
  })

  it('keeps no exception for a file that no longer exists', () => {
    const missing = UNGATED_WITH_TESTS.filter((file) => !fs.existsSync(path.join(ROOT, file)))
    expect(missing).toEqual([])
  })

  it('keeps no exception for a file the suite no longer exercises', () => {
    // An exemption outlives its reason the moment the suite behind it is
    // deleted or renamed. Without this the list would accumulate entries that
    // exempt nothing, and its own count of what is ungated would stop being
    // true.
    const exercised = new Set(subjects)
    const idle = UNGATED_WITH_TESTS.filter((file) => !exercised.has(file))
    expect(idle).toEqual([])
  })

  it('measures against the same root jest does', () => {
    // ROOT is __dirname/.. because jest defaults rootDir to the directory
    // holding the config file (jest-config/readConfigFileAndSetRootDir, the
    // `else` at the end), and shouldInstrument matches collectCoverageFrom
    // against paths relative to THAT.
    //
    // This trips on ANY explicit rootDir, including one that resolves to the
    // same directory — jest resolves a relative value against the config's own
    // dirname, so `rootDir: '.'` is harmless and still fails here. That is the
    // intent: re-implementing jest's resolution to tell the harmless case from
    // the breaking one is the kind of lookalike logic this file exists to
    // avoid. Setting rootDir should mean re-reading these paths by hand.
    expect(config.rootDir).toBeUndefined()
  })

  it('resolves a subject for all but the harness suites that have none', () => {
    // Pinned, not counted: a suite the resolver cannot place is a suite whose
    // subject stays invisible to the gate, so the blind spot has to be bounded
    // rather than tolerated. These five are the app-root harness suites, which
    // are about the harness and have no subject to find.
    expect(unresolved).toEqual([
      '__tests__/coverage-gate.test.ts',
      '__tests__/coverage-subjects.test.ts',
      '__tests__/harness-parallelism.test.ts',
      '__tests__/harness-rtl-smoke.test.tsx',
      '__tests__/harness-smoke.test.ts',
    ])
  })
})
