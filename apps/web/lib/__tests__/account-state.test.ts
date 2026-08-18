/**
 * The registry that makes a module-scoped cache survivable.
 *
 * These caches outlive their hooks ON PURPOSE — that is what stops a list
 * column blinking through a skeleton on every row opened. The consequence is
 * that they also outlive the SESSION: sign-out is a soft navigation, so the
 * next account in the same tab reads whatever the last one left behind. The
 * registry exists so `logout` can empty the lot, and the failure mode it has
 * to defend against is not a broken `clear()` — it is a NEW cache declared
 * with `createQueryCache()` beside its hook and never registered.
 */
import { describe, expect, it } from 'vitest'
import { clearAccountState } from '@/lib/account-state'
import * as accountCaches from '@/lib/account-state'

// Widened to read the module as a bag of exports: the caches are a
// heterogeneous set of `QueryCache<T>`, and the only property under test is
// the one they share — that the registry reaches every one of them.
const moduleExports: Record<string, unknown> = accountCaches
const exported = Object.entries(moduleExports).filter(
  (entry): entry is [string, Map<string, unknown>] => entry[1] instanceof Map,
)

describe('clearAccountState', () => {
  it('exports caches at all, so the sweep below cannot be vacuously true', () => {
    expect(exported.length).toBeGreaterThan(0)
  })

  it('empties EVERY cache this module exports, not a hand-listed few', () => {
    for (const [, cache] of exported) cache.set('status=open', 'planted by the test')

    clearAccountState()

    for (const [name, cache] of exported) {
      expect(cache.size, `${name} is not in the registry`).toBe(0)
    }
  })
})
