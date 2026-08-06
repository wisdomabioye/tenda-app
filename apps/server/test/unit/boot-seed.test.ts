/**
 * boot-seed — the decision half: which chains the seed would switch off, and
 * which of those still hold user funds.
 *
 * Pure, so it is tested without a database; the DB half (advisory lock, the
 * counting query, applySeed) is covered in integration/boot-seed.test.ts.
 *
 * What these guard is a stranding bug, not a cosmetic one. If `pendingDisables`
 * under-reports, a deploy that silently drops a chain's CHAIN_* env vars
 * disables that chain, it leaves /v1/platform/chains, and everyone holding an
 * unsettled escrow on it can no longer build a transaction to get their money
 * out. The check is the only thing standing between that and a green boot.
 */
import { test } from 'node:test'
import * as assert from 'node:assert'
import {
  ESCROW_STATUS_ORDER,
  ESCROW_STATUS_SETTLEMENT,
  UNSETTLED_ESCROW_STATUSES,
} from '@tenda/shared'
import { chainsToDisable, pendingDisables, describeBlockedDisable } from '@server/lib/boot-seed'

const counts = (o: Record<string, number>) => new Map(Object.entries(o))

test('a chain missing from config but holding unsettled escrows is blocked', () => {
  const blocked = pendingDisables(chainsToDisable(['solana:devnet', 'eip155:84532'], ['solana:devnet']), counts({ 'eip155:84532': 7 }))
  assert.deepStrictEqual(blocked, [{ chain_id: 'eip155:84532', unsettled: 7 }])
})

test('a chain missing from config with only settled escrows is allowed to retire', () => {
  // The whole point of counting rather than merely detecting the disable: a
  // finished chain must still be retirable without an override.
  assert.deepStrictEqual(
    pendingDisables(chainsToDisable(['solana:devnet', 'eip155:84532'], ['solana:devnet']), counts({})),
    [],
  )
})

test('a chain still in the active config is never blocked, however many escrows it holds', () => {
  assert.deepStrictEqual(
    pendingDisables(chainsToDisable(['solana:devnet', 'eip155:84532'], ['solana:devnet', 'eip155:84532']), counts({ 'eip155:84532': 999 })),
    [],
  )
})

test('a chain already disabled is not re-reported', () => {
  // Only currently-enabled rows are passed in; a chain retired earlier must not
  // resurface as a blocker on every subsequent boot.
  assert.deepStrictEqual(pendingDisables(chainsToDisable([], ['solana:devnet']), counts({ 'eip155:84532': 3 })), [])
})

test('every chain being dropped is reported, not just the first', () => {
  const blocked = pendingDisables(chainsToDisable(['a', 'b', 'c'], ['a']), counts({ b: 2, c: 5 }))
  assert.deepStrictEqual(blocked, [
    { chain_id: 'b', unsettled: 2 },
    { chain_id: 'c', unsettled: 5 },
  ])
})

test('the refusal names every chain, its count, and the override', () => {
  const msg = describeBlockedDisable([
    { chain_id: 'eip155:84532', unsettled: 7 },
    { chain_id: 'eip155:11142220', unsettled: 1 },
  ])
  assert.ok(msg.includes('eip155:84532: 7 unsettled escrow(s)'))
  assert.ok(msg.includes('eip155:11142220: 1 unsettled escrow(s)'))
  // An operator reading this at 3am needs the way out in the message itself.
  assert.ok(msg.includes('ALLOW_CHAIN_DISABLE=true'))
  // ...and the likeliest actual cause, which is not "retire this chain".
  assert.ok(msg.includes('CHAIN_* env vars'))
})

// ---------------------------------------------------------------------------
// The status split the count depends on
// ---------------------------------------------------------------------------

test('every escrow status is classified, so a new one cannot be silently missed', () => {
  // The type makes omission a compile error; this makes it a test failure too,
  // because the DB enum is what actually feeds the query.
  for (const s of ESCROW_STATUS_ORDER) {
    assert.ok(
      ESCROW_STATUS_SETTLEMENT[s] === 'settled' || ESCROW_STATUS_SETTLEMENT[s] === 'unsettled',
      `status '${s}' is not classified as settled/unsettled`,
    )
  }
  assert.strictEqual(
    Object.keys(ESCROW_STATUS_SETTLEMENT).length,
    ESCROW_STATUS_ORDER.length,
    'ESCROW_STATUS_SETTLEMENT has entries that are not real statuses',
  )
})

test('the unsettled set is exactly the funded, non-terminal statuses', () => {
  // Pinned by value, not derived from the map, so flipping a classification
  // fails here rather than silently changing what the guard counts. `disputed`
  // matters most: funds are locked AND a mediator still has to act.
  assert.deepStrictEqual(
    [...UNSETTLED_ESCROW_STATUSES].sort(),
    ['accepted', 'disputed', 'open', 'submitted'],
  )
})

test('terminal statuses are excluded — the contract has already released them', () => {
  for (const s of ['completed', 'cancelled', 'refunded', 'resolved'] as const) {
    assert.ok(
      !UNSETTLED_ESCROW_STATUSES.includes(s),
      `'${s}' is terminal and must not count as stranding anybody`,
    )
  }
})

test('draft is absent — it is off-chain and was never funded', () => {
  assert.ok(!(UNSETTLED_ESCROW_STATUSES as readonly string[]).includes('draft'))
})

test('chainsToDisable is the single source for both the count and the judgement', () => {
  // pendingDisables falls back to 0 for an id it has no count for, which is
  // fail-open. That is only safe because the ids counted and the ids judged
  // come from this one function. Pinned so a second predicate cannot creep back
  // in: an id NOT produced here can never reach pendingDisables at all.
  assert.deepStrictEqual(chainsToDisable(['a', 'b', 'c'], ['b']), ['a', 'c'])
  assert.deepStrictEqual(chainsToDisable(['a'], ['a']), [])
  assert.deepStrictEqual(chainsToDisable([], ['a']), [])
})

test('a candidate with no count entry is treated as safe — the fail-open contract', () => {
  // Documents the behaviour deliberately rather than leaving it implicit: if
  // this ever needs to be fail-CLOSED, this test is what has to change first.
  assert.deepStrictEqual(pendingDisables(['a'], new Map()), [])
})
