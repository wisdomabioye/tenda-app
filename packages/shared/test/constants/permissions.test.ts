import { test } from 'node:test'
import assert from 'node:assert/strict'
import { PERMISSIONS, ROLE_PERMISSIONS, hasPermission, type Permission } from '../../src/constants/permissions'

test('PERMISSIONS: non-empty and duplicate-free', () => {
  assert.ok(PERMISSIONS.length > 0)
  assert.equal(new Set(PERMISSIONS).size, PERMISSIONS.length)
})

test('super_admin holds every permission by construction', () => {
  for (const perm of PERMISSIONS) {
    assert.equal(hasPermission('super_admin', perm), true, `super_admin should hold ${perm}`)
  }
  assert.deepEqual([...ROLE_PERMISSIONS.super_admin], [...PERMISSIONS])
})

test('dispute_admin holds exactly its scoped grants and nothing else', () => {
  const granted: Permission[] = ['disputes.read', 'disputes.mediate', 'escrows.read']
  for (const perm of PERMISSIONS) {
    const expected = granted.includes(perm)
    assert.equal(hasPermission('dispute_admin', perm), expected, `dispute_admin ${perm} should be ${expected}`)
  }
})

test('full role × permission matrix matches ROLE_PERMISSIONS exactly', () => {
  for (const [role, perms] of Object.entries(ROLE_PERMISSIONS)) {
    const grantedSet = new Set(perms)
    for (const perm of PERMISSIONS) {
      assert.equal(hasPermission(role, perm), grantedSet.has(perm), `${role} × ${perm}`)
    }
  }
})

test("hasPermission: unmapped roles ('user', unknown, empty) hold the empty set", () => {
  for (const role of ['user', 'ghost_role', '']) {
    for (const perm of PERMISSIONS) {
      assert.equal(hasPermission(role, perm), false, `${role} should not hold ${perm}`)
    }
  }
})
