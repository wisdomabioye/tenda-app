/**
 * lib/proofs — upload validation (type, Cloudinary host, folder ownership)
 * and the poster-declared requirement gate used by POST
 * /v1/escrows/:id/submit.
 *
 * validateProofs had no unit coverage before this suite; it is the only
 * thing standing between a request body and a stored proof URL, so its
 * negative cases are asserted individually rather than as a group.
 */

import { test } from 'node:test'
import * as assert from 'node:assert'
import { ErrorCode, type ProofType } from '@tenda/shared'
import { validateProofs, assertRequirementsMet, type ProofInput } from '@server/lib/proofs'
import { AppError } from '@server/lib/errors'

const USER = 'user-1'
const OTHER = 'user-2'

function url(userId: string, name = 'p1.jpg'): string {
  return `https://res.cloudinary.com/test-cloud/image/upload/tenda/proofs/${userId}/${name}`
}

function proofs(...items: ProofInput[]): ProofInput[] {
  return items
}

function expectAppError(fn: () => void, status: number, code: string, match: RegExp) {
  assert.throws(
    fn,
    (err: unknown) =>
      err instanceof AppError &&
      err.statusCode === status &&
      err.code === code &&
      match.test(err.message),
  )
}

// ---------- validateProofs: positive ---------------------------------------

test('validateProofs accepts every declared type in the uploader own folder', () => {
  assert.doesNotThrow(() =>
    validateProofs(
      proofs(
        { url: url(USER, 'a.jpg'), type: 'image' },
        { url: url(USER, 'b.mp4'), type: 'video' },
        { url: url(USER, 'c.pdf'), type: 'document' },
      ),
      USER,
    ),
  )
})

test('validateProofs accepts an empty list', () => {
  assert.doesNotThrow(() => validateProofs([], USER))
})

test('validateProofs allows exactly maxCount items', () => {
  const items = proofs(
    { url: url(USER, 'a.jpg'), type: 'image' },
    { url: url(USER, 'b.jpg'), type: 'image' },
  )
  assert.doesNotThrow(() => validateProofs(items, USER, 2))
})

// ---------- validateProofs: negative ---------------------------------------

test('validateProofs rejects more than maxCount items', () => {
  const items = proofs(
    { url: url(USER, 'a.jpg'), type: 'image' },
    { url: url(USER, 'b.jpg'), type: 'image' },
  )
  expectAppError(
    () => validateProofs(items, USER, 1),
    400,
    ErrorCode.VALIDATION_ERROR,
    /maximum 1/,
  )
})

test('validateProofs rejects an unknown proof type', () => {
  expectAppError(
    () => validateProofs(proofs({ url: url(USER), type: 'location' }), USER),
    400,
    ErrorCode.VALIDATION_ERROR,
    /Proof type must be one of/,
  )
})

test('validateProofs rejects a non-Cloudinary host', () => {
  expectAppError(
    () =>
      validateProofs(
        proofs({ url: `https://evil.example.com/tenda/proofs/${USER}/a.jpg`, type: 'image' }),
        USER,
      ),
    400,
    ErrorCode.VALIDATION_ERROR,
    /Cloudinary/,
  )
})

test("validateProofs rejects a URL in another user's folder", () => {
  expectAppError(
    () => validateProofs(proofs({ url: url(OTHER), type: 'image' }), USER),
    400,
    ErrorCode.VALIDATION_ERROR,
    /not uploaded by the submitting user/,
  )
})

test('validateProofs reports the first violation when several are present', () => {
  // Bad type comes before the host check in the same iteration.
  expectAppError(
    () => validateProofs(proofs({ url: 'https://evil.example.com/x.jpg', type: 'nope' }), USER),
    400,
    ErrorCode.VALIDATION_ERROR,
    /Proof type must be one of/,
  )
})

// ---------- assertRequirementsMet: positive --------------------------------

const attached = (...types: ProofType[]) => types.map((type) => ({ type }))

test('no requirements passes with nothing attached', () => {
  assert.doesNotThrow(() => assertRequirementsMet([], []))
})

test('no requirements passes with proofs attached', () => {
  assert.doesNotThrow(() => assertRequirementsMet([], attached('image')))
})

test('exact coverage passes', () => {
  assert.doesNotThrow(() => assertRequirementsMet(['image', 'video'], attached('image', 'video')))
})

test('surplus proofs beyond the requirement pass', () => {
  assert.doesNotThrow(() =>
    assertRequirementsMet(['image'], attached('image', 'video', 'document')),
  )
})

test('duplicates of the required type pass', () => {
  assert.doesNotThrow(() => assertRequirementsMet(['image'], attached('image', 'image')))
})

// ---------- assertRequirementsMet: negative --------------------------------

test('nothing attached against one requirement is refused as 409', () => {
  expectAppError(
    () => assertRequirementsMet(['video'], []),
    409,
    ErrorCode.PROOF_REQUIREMENT_UNMET,
    /video/,
  )
})

test('partial coverage names only the missing type', () => {
  expectAppError(
    () => assertRequirementsMet(['image', 'video'], attached('image')),
    409,
    ErrorCode.PROOF_REQUIREMENT_UNMET,
    /video/,
  )
})

test('a wrong-type proof does not satisfy the requirement', () => {
  expectAppError(
    () => assertRequirementsMet(['document'], attached('image')),
    409,
    ErrorCode.PROOF_REQUIREMENT_UNMET,
    /document/,
  )
})

test('the error carries the missing types as structured details', () => {
  assert.throws(
    () => assertRequirementsMet(['image', 'document'], attached('image')),
    (err: unknown) =>
      err instanceof AppError &&
      JSON.stringify(err.details ?? {}).includes('document'),
  )
})
