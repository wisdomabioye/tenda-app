import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  partyRoleLabel,
  winnerLabel,
  displayName,
  resolveDisputeSender,
  disputeViewerSeat,
  type DisputeSenderArgs,
} from '../../src/utils/parties'
import type { DossierParty } from '../../src/types/dossier'

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

// ── resolveDisputeSender ────────────────────────────────────────────────────
// The three mislabellings this replaces are pinned individually below: a
// mediator seeing both disputants as one person, a party dressed up as the
// mediator, and a previous mediator attributed to the reader's opponent.

const POSTER = 'user-creator-1111'
const WORKER = 'user-counterparty-2222'
const MEDIATOR = 'admin-mediator-3333'

const PARTIES: readonly DossierParty[] = [
  { role: 'creator', user_id: POSTER, first_name: 'Ada', last_name: 'Lovelace', raised_dispute: true },
  { role: 'counterparty', user_id: WORKER, first_name: 'Tunde', last_name: 'Bello', raised_dispute: false },
]

/** Every case differs only in sender/viewer, so the rest is defaulted here. */
const senderFor = (senderId: string, viewerId: string, over: Partial<DisputeSenderArgs> = {}) =>
  resolveDisputeSender({ senderId, viewerId, kind: 'gig', parties: PARTIES, ...over })

test('resolveDisputeSender: the viewer’s own message is "me"', () => {
  assert.deepEqual(senderFor(POSTER, POSTER), { kind: 'me', role: 'creator', label: 'You' })
})

test('resolveDisputeSender: a gig creator is Poster · name', () => {
  assert.deepEqual(senderFor(POSTER, WORKER), {
    kind: 'party',
    role: 'creator',
    label: 'Poster · Ada Lovelace',
  })
})

test('resolveDisputeSender: an exchange counterparty is Taker · name', () => {
  assert.deepEqual(senderFor(WORKER, POSTER, { kind: 'exchange' }), {
    kind: 'party',
    role: 'counterparty',
    label: 'Taker · Tunde Bello',
  })
})

test('resolveDisputeSender: a non-party sender is the mediator', () => {
  assert.deepEqual(senderFor(MEDIATOR, POSTER), { kind: 'mediator', role: null, label: 'Mediator' })
})

test('resolveDisputeSender: a PREVIOUS mediator stays a mediator after a claim handoff', () => {
  // Regression: keyed off the current assignee, this fell through to "party"
  // and was labelled with the reader's OPPONENT name.
  const previous = senderFor('admin-first-mediator-9999', WORKER)
  assert.equal(previous.kind, 'mediator')
  assert.equal(previous.label, 'Mediator')
})

test('resolveDisputeSender: a party who holds the claim is still a party, never the mediator', () => {
  // Regression: an admin who is also a disputant used to be dressed up as the
  // neutral mediator to the person they were disputing with.
  assert.deepEqual(senderFor(POSTER, WORKER), {
    kind: 'party',
    role: 'creator',
    label: 'Poster · Ada Lovelace',
  })
})

test('resolveDisputeSender: a mediator reading the thread tells the two parties apart', () => {
  // THE reported bug: both disputants used to resolve to the first party.
  const fromPoster = senderFor(POSTER, MEDIATOR)
  const fromWorker = senderFor(WORKER, MEDIATOR)
  assert.equal(fromPoster.label, 'Poster · Ada Lovelace')
  assert.equal(fromWorker.label, 'Worker · Tunde Bello')
  assert.notEqual(fromPoster.label, fromWorker.label)
  assert.notEqual(fromPoster.role, fromWorker.role)
})

test('resolveDisputeSender: no party list ⇒ Participant, never a guessed Mediator', () => {
  assert.deepEqual(senderFor(POSTER, MEDIATOR, { parties: [] }), {
    kind: 'unknown',
    role: null,
    label: 'Participant',
  })
})

test('resolveDisputeSender: the viewer is still "me" with no party list', () => {
  // Ordering guard: self must resolve before the unplaceable branch.
  assert.deepEqual(senderFor(POSTER, POSTER, { parties: [] }), {
    kind: 'me',
    role: null,
    label: 'You',
  })
})

test('resolveDisputeSender: a null kind drops the role prefix but keeps the role', () => {
  assert.deepEqual(senderFor(WORKER, POSTER, { kind: null }), {
    kind: 'party',
    role: 'counterparty',
    label: 'Tunde Bello',
  })
})

test('resolveDisputeSender: a nameless party falls back to the shortened id', () => {
  const anonymous: readonly DossierParty[] = [
    { role: 'creator', user_id: POSTER, first_name: null, last_name: null, raised_dispute: false },
  ]
  assert.equal(senderFor(POSTER, MEDIATOR, { parties: anonymous }).label, 'Poster · User user-cre')
})

test('resolveDisputeSender: an empty viewer id matches nobody', () => {
  // The mobile auth store yields '' before hydration; it must not claim a bubble.
  const sender = senderFor(POSTER, '')
  assert.equal(sender.kind, 'party')
  assert.equal(sender.label, 'Poster · Ada Lovelace')
})

test('resolveDisputeSender: a one-party escrow still places the mediator', () => {
  const soloParty: readonly DossierParty[] = [PARTIES[0]]
  assert.equal(senderFor(MEDIATOR, POSTER, { parties: soloParty }).kind, 'mediator')
})

// ── disputeViewerSeat ───────────────────────────────────────────────────────
// Callers WITHHOLD things on this answer (the composer, disputant-shaped
// copy), so the failure that matters is silencing a real disputant.

test('disputeViewerSeat: a disputant is a party', () => {
  assert.equal(disputeViewerSeat(PARTIES, POSTER), 'party')
  assert.equal(disputeViewerSeat(PARTIES, WORKER), 'party')
})

test('disputeViewerSeat: someone outside the party list is the mediator', () => {
  assert.equal(disputeViewerSeat(PARTIES, MEDIATOR), 'mediator')
})

test('disputeViewerSeat: no party list is unknown, never a guessed mediator', () => {
  // A tail poll before the full load. Guessing "mediator" here would strip a
  // disputant's composer mid-conversation.
  assert.equal(disputeViewerSeat([], POSTER), 'unknown')
})

test('disputeViewerSeat: an unhydrated viewer id is unknown, not a mediator', () => {
  assert.equal(disputeViewerSeat(PARTIES, ''), 'unknown')
})

test('disputeViewerSeat: agrees with resolveDisputeSender on the same reader', () => {
  // The two must never disagree — that split is what produced the original
  // mislabelling. A party reads as their own message; an outsider as mediator.
  assert.equal(resolveDisputeSender({ senderId: MEDIATOR, viewerId: POSTER, kind: 'gig', parties: PARTIES }).kind, 'mediator')
  assert.equal(disputeViewerSeat(PARTIES, MEDIATOR), 'mediator')
  assert.equal(disputeViewerSeat(PARTIES, POSTER), 'party')
})
