/**
 * #90 — permission-driven nav: the sidebar must mirror the server's
 * ROLE_PERMISSIONS exactly (same shared hasPermission), so a role never
 * sees a surface the API would 403.
 */
import { test } from 'vitest'
import assert from 'node:assert'
import { PERMISSIONS } from '@tenda/shared'
import { NAV_ITEMS, visibleNav } from '../lib/nav'

test('super_admin sees every nav surface', () => {
  assert.deepStrictEqual(visibleNav('super_admin'), [...NAV_ITEMS])
})

test('dispute_admin sees exactly the dispute-workflow surfaces', () => {
  // ROLE_PERMISSIONS: disputes.read + disputes.mediate + escrows.read.
  assert.deepStrictEqual(
    visibleNav('dispute_admin').map((i) => i.href),
    ['/disputes', '/escrows'],
  )
})

test('plain users and unknown roles see nothing', () => {
  assert.deepStrictEqual(visibleNav('user'), [])
  assert.deepStrictEqual(visibleNav('made_up_role'), [])
})

test('every nav permission exists in the shared PERMISSIONS list', () => {
  const known = new Set<string>(PERMISSIONS)
  for (const item of NAV_ITEMS) {
    assert.ok(known.has(item.permission), `unknown permission '${item.permission}' on ${item.href}`)
  }
})

test('nav hrefs are unique', () => {
  const hrefs = NAV_ITEMS.map((i) => i.href)
  assert.strictEqual(new Set(hrefs).size, hrefs.length)
})
