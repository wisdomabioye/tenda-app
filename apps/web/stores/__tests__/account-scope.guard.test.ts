/**
 * Every store must decide whether its state may outlive an account.
 *
 * This is the test that would have caught #25 three tasks earlier. `gigs`,
 * `escrow` and `signin-flow` were each added long after the clearing existed,
 * and each was simply never wired into it — not because anyone disagreed, but
 * because the place you had to remember (`logout`) was nowhere near the file
 * you were writing. Every behavioural test in the suite passed throughout.
 *
 * So this one reads the DIRECTORY rather than a list someone maintains: a new
 * store file is a failure until it either registers a reset or is named below
 * with a reason. It cannot pass by being forgotten.
 *
 * It asserts a convention, not a behaviour, which is why it inspects source
 * text. The behaviour — that a registered reset actually empties the store on
 * sign-out and on a cross-tab switch — is `account-switch.test.ts`.
 */
import { readdirSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const STORES_DIR = dirname(dirname(fileURLToPath(import.meta.url)))

/**
 * Stores whose state is the SAME for every reader, or which own the session
 * itself. Each needs a reason, because "it looked harmless" is how the three
 * leaks got in.
 */
const ACCOUNT_AGNOSTIC: Record<string, string> = {
  'auth.store.ts':
    'owns the session; resets itself to SIGNED_OUT and drives the clearing of everything else',
  'chain-registry.store.ts':
    'public enabled-chain registry — token addresses, identical for every reader. Clearing it would blank a rendered balance while it refetched',
  'platform-config.store.ts':
    'public fee tiers and rates, identical for every reader',
  'realtime.store.ts':
    'holds only `connected`, derived from the socket — and useRealtimeConnection tears that socket down when isAuthenticated goes false',
}

function storeFiles(): string[] {
  return readdirSync(STORES_DIR)
    .filter((name) => name.endsWith('.store.ts'))
    .sort()
}

describe('account-scope classification', () => {
  it('finds the stores at all — a bad path would make every case below vacuous', () => {
    // Without this, a wrong STORES_DIR yields an empty list and the loop asserts
    // nothing while reporting success.
    expect(storeFiles().length).toBeGreaterThanOrEqual(8)
  })

  it.each(storeFiles())('%s is either account-scoped or documented as not', (name) => {
    const source = readFileSync(join(STORES_DIR, name), 'utf8')
    const registers = source.includes('registerAccountReset(')
    const agnostic = name in ACCOUNT_AGNOSTIC

    // Both is a contradiction: a store cannot be public AND cleared per account.
    expect(registers && agnostic).toBe(false)
    expect(registers || agnostic).toBe(true)
  })

  it('has no stale entries — an allowlist may not outlive the file it excuses', () => {
    const present = new Set(storeFiles())
    for (const name of Object.keys(ACCOUNT_AGNOSTIC)) {
      expect(present.has(name)).toBe(true)
    }
  })

  it('gives every excused store a REASON, not just an entry', () => {
    // Reported as the offending NAMES rather than a bare length assertion, so
    // a failure says which store is excused without saying why.
    const unexplained = Object.entries(ACCOUNT_AGNOSTIC)
      .filter(([, reason]) => reason.trim().length <= 20)
      .map(([name]) => name)

    expect(unexplained).toEqual([])
  })
})
