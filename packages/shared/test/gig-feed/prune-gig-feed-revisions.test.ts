/**
 * The feed's revision memory is bounded (#73): current rows always, the most
 * recently departed up to the memory, nothing older.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { MAX_PAGINATION_LIMIT } from '../../src/utils/validation'
import { GIG_FEED_REVISION_MEMORY, pruneGigFeedRevisions } from '../../src/gig-feed/prune-gig-feed-revisions'

const map = (n: number, prefix = 'g'): Record<string, string> =>
  Object.fromEntries(Array.from({ length: n }, (_, i) => [`${prefix}${i}`, String(i)]))

test('the memory is derived from the server page cap, never typed', () => {
  assert.equal(GIG_FEED_REVISION_MEMORY, MAX_PAGINATION_LIMIT * 2)
  assert.ok(GIG_FEED_REVISION_MEMORY > 0)
})

test('under the memory nothing is forgotten, and the same object comes back', () => {
  const revisions = map(5)
  assert.equal(pruneGigFeedRevisions(revisions, [], 5), revisions)
  assert.equal(pruneGigFeedRevisions(revisions, ['g0'], 4), revisions)
})

test('over the memory the OLDEST departed go first, the newest departed stay', () => {
  const pruned = pruneGigFeedRevisions(map(10), [], 3)
  assert.deepEqual(Object.keys(pruned), ['g7', 'g8', 'g9'])
})

test('a current row is kept however many others are remembered — even at memory 0', () => {
  const pruned = pruneGigFeedRevisions(map(10), ['g0', 'g4'], 0)
  assert.deepEqual(Object.keys(pruned), ['g0', 'g4'])
  assert.equal(pruned.g4, '4', 'the revision itself is untouched')
})

test('current rows do not spend the memory: departed entries are counted on their own', () => {
  // 6 current + 4 departed with memory 4 → nothing forgotten, though 10 > 4.
  const revisions = map(10)
  const current = ['g0', 'g1', 'g2', 'g3', 'g4', 'g5']
  assert.equal(pruneGigFeedRevisions(revisions, current, 4), revisions)
  // memory 3 → exactly the oldest departed (g6) goes.
  assert.deepEqual(Object.keys(pruneGigFeedRevisions(revisions, current, 3)), ['g0', 'g1', 'g2', 'g3', 'g4', 'g5', 'g7', 'g8', 'g9'])
})

test('a negative memory reads as zero rather than keeping everything', () => {
  assert.deepEqual(Object.keys(pruneGigFeedRevisions(map(3), ['g1'], -5)), ['g1'])
})
