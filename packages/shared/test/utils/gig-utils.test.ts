import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  computeRelevantDeadline,
  canPublish,
  canAccept,
  canSubmit,
  canAddProof,
  canApprove,
  canDispute,
  canReview,
  canCancel,
  canClaim,
} from '../../src/utils/gig-utils'
import type { EscrowStatus } from '../../src/types/escrow'

const CREATOR = 'user-creator'
const COUNTERPARTY = 'user-counterparty'
const STRANGER = 'user-stranger'

function escrow(status: EscrowStatus, counterparty: string | null = COUNTERPARTY) {
  return { status, creator_id: CREATOR, counterparty_id: counterparty }
}

const DEADLINES = {
  accept_deadline: '2026-06-10T00:00:00.000Z',
  completion_deadline: '2026-06-11T00:00:00.000Z',
  approval_deadline: '2026-06-12T00:00:00.000Z',
}

test('computeRelevantDeadline: picks accept_deadline when open', () => {
  const d = computeRelevantDeadline({ status: 'open', ...DEADLINES })
  assert.equal(d?.toISOString(), '2026-06-10T00:00:00.000Z')
})

test('computeRelevantDeadline: picks completion_deadline when accepted', () => {
  const d = computeRelevantDeadline({ status: 'accepted', ...DEADLINES })
  assert.equal(d?.toISOString(), '2026-06-11T00:00:00.000Z')
})

test('computeRelevantDeadline: picks approval_deadline when submitted', () => {
  const d = computeRelevantDeadline({ status: 'submitted', ...DEADLINES })
  assert.equal(d?.toISOString(), '2026-06-12T00:00:00.000Z')
})

test('computeRelevantDeadline: null for other statuses', () => {
  assert.equal(computeRelevantDeadline({ status: 'completed', ...DEADLINES }), null)
  assert.equal(computeRelevantDeadline({ status: 'draft', ...DEADLINES }), null)
})

test('computeRelevantDeadline: open with a null accept_deadline yields null (indefinitely open)', () => {
  assert.equal(computeRelevantDeadline({ status: 'open', ...DEADLINES, accept_deadline: null }), null)
})

test('computeRelevantDeadline: accepts Date inputs as well as ISO strings', () => {
  const d = computeRelevantDeadline({
    status: 'open',
    accept_deadline: new Date('2026-06-10T00:00:00.000Z'),
    completion_deadline: null,
    approval_deadline: null,
  })
  assert.equal(d?.toISOString(), '2026-06-10T00:00:00.000Z')
})

test('canPublish: only the creator on a draft', () => {
  assert.equal(canPublish(escrow('draft'), CREATOR), true)
  assert.equal(canPublish(escrow('draft'), COUNTERPARTY), false)
  assert.equal(canPublish(escrow('open'), CREATOR), false)
})

test('canAccept: any non-creator on an open escrow', () => {
  assert.equal(canAccept(escrow('open', null), COUNTERPARTY), true)
  assert.equal(canAccept(escrow('open', null), CREATOR), false) // cannot accept own
  assert.equal(canAccept(escrow('draft', null), COUNTERPARTY), false)
})

test('canSubmit: only the counterparty on an accepted escrow', () => {
  assert.equal(canSubmit(escrow('accepted'), COUNTERPARTY), true)
  assert.equal(canSubmit(escrow('accepted'), CREATOR), false)
  assert.equal(canSubmit(escrow('open'), COUNTERPARTY), false)
})

test('canAddProof: the counterparty while submitted OR disputed, never others', () => {
  assert.equal(canAddProof(escrow('submitted'), COUNTERPARTY), true)
  // Evidence stays open through a dispute so the mediator can request more.
  assert.equal(canAddProof(escrow('disputed'), COUNTERPARTY), true)
  assert.equal(canAddProof(escrow('submitted'), CREATOR), false)
  assert.equal(canAddProof(escrow('disputed'), CREATOR), false)
  assert.equal(canAddProof(escrow('disputed'), STRANGER), false)
  assert.equal(canAddProof(escrow('accepted'), COUNTERPARTY), false)
  assert.equal(canAddProof(escrow('completed'), COUNTERPARTY), false)
})

test('canApprove: only the creator on a submitted escrow', () => {
  assert.equal(canApprove(escrow('submitted'), CREATOR), true)
  assert.equal(canApprove(escrow('submitted'), COUNTERPARTY), false)
  assert.equal(canApprove(escrow('accepted'), CREATOR), false)
})

test('canDispute: either party while accepted or submitted, not a stranger', () => {
  assert.equal(canDispute(escrow('accepted'), CREATOR), true)
  assert.equal(canDispute(escrow('submitted'), COUNTERPARTY), true)
  assert.equal(canDispute(escrow('accepted'), STRANGER), false)
  assert.equal(canDispute(escrow('open'), CREATOR), false)
})

test('canReview: either party once completed or resolved', () => {
  assert.equal(canReview(escrow('completed'), CREATOR), true)
  assert.equal(canReview(escrow('resolved'), COUNTERPARTY), true)
  assert.equal(canReview(escrow('completed'), STRANGER), false)
  assert.equal(canReview(escrow('submitted'), CREATOR), false)
})

test('canCancel: only the creator on a draft or open escrow', () => {
  assert.equal(canCancel(escrow('draft'), CREATOR), true)
  assert.equal(canCancel(escrow('open'), CREATOR), true)
  assert.equal(canCancel(escrow('open'), COUNTERPARTY), false)
  assert.equal(canCancel(escrow('accepted'), CREATOR), false)
})

test('canClaim: counterparty after the approval_deadline passes, against an injected clock', () => {
  const e = { ...escrow('submitted'), approval_deadline: '2026-06-12T00:00:00.000Z' }
  const afterDeadline = new Date('2026-06-12T00:00:01.000Z')
  const beforeDeadline = new Date('2026-06-11T23:59:59.000Z')
  assert.equal(canClaim(e, COUNTERPARTY, afterDeadline), true)
  assert.equal(canClaim(e, COUNTERPARTY, beforeDeadline), false) // deadline not reached
  assert.equal(canClaim(e, CREATOR, afterDeadline), false) // wrong caller
})

test('canClaim: false when status is not submitted or approval_deadline is null', () => {
  const noDeadline = { ...escrow('submitted'), approval_deadline: null }
  assert.equal(canClaim(noDeadline, COUNTERPARTY, new Date('2030-01-01T00:00:00.000Z')), false)
  const wrongStatus = { ...escrow('accepted'), approval_deadline: '2026-06-12T00:00:00.000Z' }
  assert.equal(canClaim(wrongStatus, COUNTERPARTY, new Date('2030-01-01T00:00:00.000Z')), false)
})
