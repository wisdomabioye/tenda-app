/**
 * Which modules the unit suite actually exercises.
 *
 * The coverage gate is an allow-list (`collectCoverageFrom` in jest.config.js),
 * so a file outside it contributes nothing to the global figures even when it
 * has a full suite — "mobile coverage is 92%" is a statement about the LISTED
 * files, not about mobile. #58 exists because that drift is invisible: nothing
 * fails when a new suite lands on an unlisted file, and three separate tasks
 * (#49, #51, #56) each found one by accident.
 *
 * To notice it you first have to answer "what do the tests exercise?" without
 * running them. Two signals, in order:
 *
 *   BY NAME — `hooks/__tests__/useFoo.test.ts` tests `hooks/useFoo.ts`: the
 *   module of the same name in the directory that owns the `__tests__` folder.
 *   Suffixed splits count too (`useFoo.races.test.ts` -> `useFoo.ts`), because
 *   that is how the big suites here were split (#39, #54).
 *
 *   BY IMPORT — a suite named for a THEME rather than a module
 *   (`realtime-chat-mirror.test.ts`) declares its subjects by importing them.
 *   Only imports landing inside the owning directory count — at any depth, so
 *   `app/wallet/__tests__/intent.test.tsx` reaches `app/wallet/intents/[id]`.
 *   Anything outside it is a collaborator, not a subject.
 *
 * The by-import signal is deliberately the fallback, not an addition. Applied
 * to every suite it re-labels every shared component a sibling's test happens
 * to render — Button, Text, Chip and SectionLabel all became "subjects" of the
 * ui suites when it ran unconditionally. That is the reason for the ordering,
 * not a preference; __tests__/coverage-subjects.test.ts pins the case.
 *
 * KNOWN LIMIT, stated because a checker that overclaims is worse than none:
 * a theme-named suite whose subject it does not import — through a helper, or
 * a barrel two directories up — resolves to nothing and is reported as
 * unresolved rather than silently counted.
 */
import fs from 'node:fs'
import path from 'node:path'

/** Extensions a subject can have. Order is resolution order. */
const SOURCE_EXTENSIONS = ['.ts', '.tsx'] as const

/** Never walked: dependencies, build output, native projects, VCS metadata. */
const SKIPPED_DIRECTORIES = new Set(['node_modules', '.expo', 'coverage', 'android', 'ios', '.git'])

const TESTS_DIRECTORY = '__tests__'
const TEST_FILE = /\.test\.tsx?$/
/** `from '…'`, `require('…')` and `jest.mock('…')` — the three ways a suite names a module. */
const IMPORT_SPECIFIER = /(?:\bfrom\s*|\brequire\(\s*|\bjest\.mock\(\s*)['"]([^'"]+)['"]/g
/** tsconfig `paths`: `@/*` -> `./*`, rooted at the app directory. */
const ALIAS_PREFIX = '@/'

export interface TestSubjects {
  /** Every `*.test.ts(x)` under a `__tests__` directory, root-relative. */
  testFiles: string[]
  /** Every `.ts`/`.tsx` outside `__tests__` — what the gate could match. */
  sourceFiles: string[]
  /** Every module those suites exercise, root-relative, sorted and unique. */
  subjects: string[]
  /** Suites no subject could be resolved for — the known limit above. */
  unresolved: string[]
}

/** Root-relative POSIX path, so the keys match `collectCoverageFrom` globs. */
function toKey(root: string, absolute: string): string {
  return path.relative(root, absolute).split(path.sep).join('/')
}

function listFiles(root: string): string[] {
  const found: string[] = []
  const visit = (directory: string): void => {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      if (SKIPPED_DIRECTORIES.has(entry.name)) continue
      const child = path.join(directory, entry.name)
      if (entry.isDirectory()) visit(child)
      else found.push(toKey(root, child))
    }
  }
  visit(root)
  return found
}

/**
 * Resolve a specifier the way an import in this app resolves: the exact path,
 * then a `.ts`/`.tsx` extension, then a directory's index barrel. Metro's
 * platform suffixes (`.ios.ts`, `.native.ts`) and its `.js` resolutions are
 * deliberately NOT modelled — nothing under test here is written that way, and
 * a half-copy of Metro's algorithm would be the lookalike logic this module
 * exists to avoid.
 */
function resolveModule(files: ReadonlySet<string>, candidate: string): string | null {
  const attempts = [
    candidate,
    ...SOURCE_EXTENSIONS.map((extension) => candidate + extension),
    ...SOURCE_EXTENSIONS.map((extension) => `${candidate}/index${extension}`),
  ]
  return attempts.find((attempt) => files.has(attempt)) ?? null
}

/** `hooks/__tests__/useFoo.bar.test.ts` -> `hooks` */
function ownerOf(testFile: string): string {
  return path.posix.dirname(path.posix.dirname(testFile))
}

function subjectByName(files: ReadonlySet<string>, testFile: string): string | null {
  const owner = ownerOf(testFile)
  let stem = path.posix.basename(testFile).replace(TEST_FILE, '')
  while (stem) {
    const hit = resolveModule(files, path.posix.join(owner, stem))
    if (hit) return hit
    // `<= 0`, not `< 0`: a name whose only dot is at index 0 (`.foo.test.ts`)
    // strips to an empty stem, which ends the loop at a SECOND `return null`
    // that no mutation can tell apart from this one. One exit instead.
    const split = stem.lastIndexOf('.')
    if (split <= 0) break
    stem = stem.slice(0, split)
  }
  return null
}

function subjectsByImport(files: ReadonlySet<string>, testFile: string, source: string): string[] {
  const owner = ownerOf(testFile)
  const found = new Set<string>()
  for (const [, specifier] of source.matchAll(IMPORT_SPECIFIER)) {
    const candidate = specifier.startsWith(ALIAS_PREFIX)
      ? specifier.slice(ALIAS_PREFIX.length)
      : specifier.startsWith('.')
        ? path.posix.normalize(path.posix.join(path.posix.dirname(testFile), specifier))
        : null
    if (candidate === null) continue
    const hit = resolveModule(files, candidate)
    // Anywhere UNDER the owning directory, not just directly in it: the two
    // screen suites that named a theme reach one level down for their subject
    // (`app/wallet/__tests__/intent.test.tsx` -> `app/wallet/intents/[id].tsx`).
    //
    // This is also what excuses the app-root harness suites, which import half
    // the app through `@/` and own nothing: their owner is '.', the prefix is
    // './', and no root-relative key begins that way. An explicit early return
    // for that case was written first and deleted — it changed no behaviour,
    // and a guard that cannot be broken cannot be proved either.
    if (hit !== null && hit.startsWith(`${owner}/`) && !hit.includes(`${TESTS_DIRECTORY}/`)) {
      found.add(hit)
    }
  }
  return [...found]
}

/** Walk `root` and report what its suites exercise. */
export function collectTestSubjects(root: string): TestSubjects {
  const files = listFiles(root)
  const index = new Set(files)
  const isTest = (file: string): boolean =>
    file.includes(`${TESTS_DIRECTORY}/`) && TEST_FILE.test(file)
  const testFiles = files.filter(isTest).sort()
  // Everything under `__tests__` is out, not just the `*.test.ts` files: the
  // effective testMatch here is jest's default `**/__tests__/**/*.[jt]s?(x)`
  // (confirmed with `jest --showConfig`; neither jest-expo nor this config
  // overrides it), so shouldInstrument refuses a `.ts` helper sitting beside a
  // suite as firmly as it refuses the suite. Counting one would let a pattern
  // that instruments nothing look alive.
  const sourceFiles = files
    .filter(
      (file) =>
        !file.includes(`${TESTS_DIRECTORY}/`) &&
        SOURCE_EXTENSIONS.some((extension) => file.endsWith(extension)),
    )
    .sort()

  const subjects = new Set<string>()
  const unresolved: string[] = []
  for (const testFile of testFiles) {
    const named = subjectByName(index, testFile)
    if (named !== null) {
      subjects.add(named)
      continue
    }
    const imported = subjectsByImport(index, testFile, fs.readFileSync(path.join(root, testFile), 'utf8'))
    if (imported.length === 0) unresolved.push(testFile)
    imported.forEach((subject) => subjects.add(subject))
  }
  return { testFiles, sourceFiles, subjects: [...subjects].sort(), unresolved }
}
