import { test } from 'node:test'
import assert from 'node:assert/strict'
import { partyRoleLabel, winnerLabel, displayName } from '../../src/utils/parties'

test('partyRoleLabel: gig uses Poster / Worker', () => {
  assert.equal(partyRoleLabel('gig', 'creator'), 'Poster')
  assert.equal(partyRoleLabel('gig', 'counterparty'), 'Worker')
})

test('partyRoleLabel: exchange uses Maker / Taker', () => {
  assert.equal(partyRoleLabel('exchange', 'creator'), 'Maker')
  assert.equal(partyRoleLabel('exchange', 'counterparty'), 'Taker')
})

test('winnerLabel: parties reuse the role labels, split is even-split copy', () => {
  assert.equal(winnerLabel('gig', 'creator'), 'Poster')
  assert.equal(winnerLabel('gig', 'counterparty'), 'Worker')
  assert.equal(winnerLabel('exchange', 'counterparty'), 'Taker')
  assert.equal(winnerLabel('gig', 'split'), 'Split evenly')
})

test('displayName: joins both names', () => {
  assert.equal(displayName('Ada', 'Lovelace'), 'Ada Lovelace')
})

test('displayName: tolerates one missing/blank name', () => {
  assert.equal(displayName('Ada', null), 'Ada')
  assert.equal(displayName(null, 'Lovelace'), 'Lovelace')
  assert.equal(displayName('Ada', '   '), 'Ada')
})

test('displayName: falls back to a shortened id when both names are absent', () => {
  assert.equal(displayName(null, null, 'abcdef12-3456-7890'), 'User abcdef12')
})

test('displayName: falls back to Unknown with no usable name or id', () => {
  assert.equal(displayName(null, null), 'Unknown')
  assert.equal(displayName('  ', '  ', ''), 'Unknown')
})
