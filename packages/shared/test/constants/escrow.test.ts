import { test } from 'node:test'
import assert from 'node:assert/strict'
import { ESCROW_TX_TYPES, isEscrowTxType, DEFAULT_ACCEPT_WINDOW_SECONDS } from '../../src/constants/escrow'

test('ESCROW_TX_TYPES: non-empty and free of duplicates', () => {
  assert.ok(ESCROW_TX_TYPES.length > 0)
  assert.equal(new Set(ESCROW_TX_TYPES).size, ESCROW_TX_TYPES.length)
})

test('isEscrowTxType: accepts every declared type', () => {
  for (const t of ESCROW_TX_TYPES) assert.equal(isEscrowTxType(t), true)
})

test('isEscrowTxType: rejects unknown strings and non-strings', () => {
  assert.equal(isEscrowTxType('teleport'), false)
  assert.equal(isEscrowTxType(''), false)
  assert.equal(isEscrowTxType(42), false)
  assert.equal(isEscrowTxType(null), false)
  assert.equal(isEscrowTxType(undefined), false)
})

test('DEFAULT_ACCEPT_WINDOW_SECONDS equals 7 days', () => {
  assert.equal(DEFAULT_ACCEPT_WINDOW_SECONDS, 7 * 24 * 60 * 60)
})
