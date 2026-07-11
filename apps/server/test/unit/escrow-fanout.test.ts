/**
 * workers/escrow-fanout — kind-aware push copy matrix. The fan-out itself
 * (DB + queue) is covered by the worker integration tests; here we pin the
 * per-kind wording + recipient so an exchange never gets gig copy again.
 */

import { test } from 'node:test'
import * as assert from 'node:assert'
import { escrowNoticeFor } from '@server/workers/escrow-fanout'
import type { InternalEscrowEvent } from '@server/lib/escrow-events'

const LIFECYCLE: InternalEscrowEvent[] = [
  'escrow.accepted',
  'escrow.declined',
  'escrow.proof_submitted',
  'escrow.approved',
  'escrow.payment_claimed',
  'escrow.abandoned',
  'escrow.dispute_raised',
  'escrow.dispute_resolved',
]

test('every lifecycle event has DISTINCT gig vs exchange copy', () => {
  for (const event of LIFECYCLE) {
    const gig = escrowNoticeFor(event, 'gig')
    const exch = escrowNoticeFor(event, 'exchange')
    assert.ok(gig !== null, `gig copy missing for ${event}`)
    assert.ok(exch !== null, `exchange copy missing for ${event}`)
    // Same recipient regardless of kind — only the wording differs.
    assert.strictEqual(gig.recipient, exch.recipient, `recipient drift on ${event}`)
    // The whole point of the fix: the two kinds must not share a body.
    assert.notStrictEqual(gig.body, exch.body, `${event} shares one body across kinds`)
  }
})

test('exchange copy never leaks gig vocabulary (worker/gig/poster)', () => {
  const gigWords = /\b(gig|worker|poster)\b/i
  for (const event of LIFECYCLE) {
    const exch = escrowNoticeFor(event, 'exchange')
    assert.ok(exch !== null)
    assert.ok(!gigWords.test(exch.title), `exchange title leaks gig word on ${event}: ${exch.title}`)
    assert.ok(!gigWords.test(exch.body), `exchange body leaks gig word on ${event}: ${exch.body}`)
  }
})

test('accepted → notifies the creator; approved → notifies the counterparty', () => {
  assert.strictEqual(escrowNoticeFor('escrow.accepted', 'exchange')?.recipient, 'creator')
  assert.strictEqual(escrowNoticeFor('escrow.approved', 'exchange')?.recipient, 'counterparty')
  assert.strictEqual(escrowNoticeFor('escrow.dispute_raised', 'gig')?.recipient, 'both')
})

test('exchange accept/approve read from the P2P buyer/seller perspective', () => {
  assert.match(escrowNoticeFor('escrow.accepted', 'exchange')!.body, /buyer accepted/i)
  assert.match(escrowNoticeFor('escrow.approved', 'exchange')!.body, /crypto is in your wallet/i)
  assert.match(escrowNoticeFor('escrow.proof_submitted', 'exchange')!.body, /marked the payment/i)
})

test('non-notifying events (created/cancelled) return null', () => {
  assert.strictEqual(escrowNoticeFor('escrow.created', 'gig'), null)
  assert.strictEqual(escrowNoticeFor('escrow.cancelled', 'exchange'), null)
})
