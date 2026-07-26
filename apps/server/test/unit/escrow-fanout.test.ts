/**
 * workers/escrow-fanout — kind-aware push copy matrix. The fan-out itself
 * (DB + queue) is covered by the worker integration tests; here we pin the
 * per-kind wording + recipient so an exchange never gets gig copy again.
 */

import { test } from 'node:test'
import * as assert from 'node:assert'
import { escrowNoticeFor } from '@server/workers/escrow-fanout'
import { INTERNAL_EVENT_BY_WIRE, type InternalEscrowEvent } from '@server/lib/escrow-events'

/**
 * Events that deliberately send NO push, each with the reason. This list is
 * the point of the test below: `NOTICE_BY_EVENT` is a `Partial<Record<>>`, so
 * a new event compiles fine while silently notifying nobody. Requiring every
 * event to be EITHER notifying OR listed here turns that silence into a
 * decision someone made on purpose.
 *
 * `escrow.counterparty_assigned` is exactly the case this guards: in approval
 * mode the worker signs nothing, so the push is the only way they learn the
 * gig is theirs — and it shipped missing.
 */
const DELIBERATELY_SILENT: Partial<Record<InternalEscrowEvent, string>> = {
  'escrow.created': 'the actor’s own doing; subscribers get the new-gig fan-out instead',
  'escrow.cancelled': 'the actor’s own doing',
  'escrow.expired': 'the expire-escrows job sends its own notice',
}

const ALL_EVENTS = Object.values(INTERNAL_EVENT_BY_WIRE)

/** Every event that is expected to notify — derived, never hand-listed. */
const LIFECYCLE: InternalEscrowEvent[] = ALL_EVENTS.filter(
  (e) => DELIBERATELY_SILENT[e] === undefined,
)

test('every internal event either notifies or is on the deliberate-silence list', () => {
  for (const event of ALL_EVENTS) {
    const notice = escrowNoticeFor(event, 'gig')
    const silent = DELIBERATELY_SILENT[event] !== undefined
    assert.ok(
      notice !== null || silent,
      `${event} notifies nobody and is not listed as deliberately silent — add push copy, or record why it stays quiet`,
    )
    assert.ok(
      notice === null || !silent,
      `${event} is listed as deliberately silent but has push copy`,
    )
  }
})

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

test('approval-mode events address the WORKER, who never acted', () => {
  // The creator initiated both transitions, so they already know; the worker
  // is the one with no other way to find out.
  for (const kind of ['gig', 'exchange'] as const) {
    assert.strictEqual(
      escrowNoticeFor('escrow.counterparty_assigned', kind)?.recipient,
      'counterparty',
    )
    assert.strictEqual(
      escrowNoticeFor('escrow.assignment_released', kind)?.recipient,
      'counterparty',
    )
  }
})
