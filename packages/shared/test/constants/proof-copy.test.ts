/**
 * The shared proof sentences.
 *
 * These exist so a worker cannot be told the same fact two ways by the app,
 * the web and the server. The tests that matter here are therefore about
 * VOCABULARY — every phrase goes through `formatProofTypeList` — and about the
 * retry line's two counting rules, which are the ones that were got wrong.
 */
import { test } from 'node:test'
import assert from 'node:assert'
import { PROOF_COPY, proofRequirementLine } from '../../src/constants/proof-copy'
import { formatProofTypeList } from '../../src/constants/proofs'

test('the requirement is worded by the SHARED formatter, not a local join', () => {
  // A hand-rolled comma join is exactly what this replaced: it read
  // "photo, video" where the server said "photo and video".
  assert.strictEqual(
    PROOF_COPY.required(['image', 'video']),
    `Required proof: ${formatProofTypeList(['image', 'video'])}`,
  )
  assert.match(PROOF_COPY.required(['image', 'video']), /photo and video/)
})

test('what is still needed is worded the same way', () => {
  assert.strictEqual(PROOF_COPY.stillNeeded(['video']), 'Still needed: video')
  assert.match(PROOF_COPY.stillNeeded(['image', 'video', 'document']), /photo, video and document/)
})

test('a single required type reads as itself, with no list punctuation', () => {
  assert.strictEqual(PROOF_COPY.required(['document']), 'Required proof: document')
})

test('the paragraph form states the requirement AND its status', () => {
  assert.strictEqual(
    proofRequirementLine(['image', 'video'], ['video']),
    'Required proof: photo and video. Still needed: video.',
  )
})

test('nothing missing reads as covered, not as an empty "still needed"', () => {
  assert.strictEqual(
    proofRequirementLine(['image'], []),
    'Required proof: photo. All required proof attached.',
  )
})

test('the retry line counts FILES, and lists TYPES', () => {
  // Three photos is an ordinary batch: listing per row read
  // "Photo, Photo, Photo", so the types are deduplicated and the count carries
  // the rest.
  const line = PROOF_COPY.alreadyAttached(['image', 'image', 'video'])
  assert.match(line, /3 files/)
  assert.match(line, /\(photo and video\)/)
})

test('the plural follows the FILE count, not the type count', () => {
  const one = PROOF_COPY.alreadyAttached(['image'])
  assert.match(one, /1 file \(/)
  assert.match(one, /reuses it —/)

  // Two files of the SAME type: one type, but still "files" and "them".
  const two = PROOF_COPY.alreadyAttached(['image', 'image'])
  assert.match(two, /2 files \(/)
  assert.match(two, /reuses them —/)
})

test('the retry line orders types canonically, whatever order they arrived in', () => {
  // Through the shared normaliser, so video-then-photo and photo-then-video
  // read identically — two workers must not see the same escrow described
  // differently.
  assert.strictEqual(
    PROOF_COPY.alreadyAttached(['video', 'image']),
    PROOF_COPY.alreadyAttached(['image', 'video']),
  )
})

test('the pre-accept line tells the worker what accepting commits them to', () => {
  // It belongs to the arm where NOTHING is attached yet, so it must not be
  // phrased as something being missing from an upload in progress.
  assert.match(PROOF_COPY.attachBeforeSubmit, /before you can submit/)
  assert.doesNotMatch(PROOF_COPY.attachBeforeSubmit, /still needed/i)
})
