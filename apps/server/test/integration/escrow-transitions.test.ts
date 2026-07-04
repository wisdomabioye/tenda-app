/**
 * #98 gap-fill — escrow state-transition routes (build-unsigned-tx happy
 * paths + caller/status guards), exercising lib/escrow-routes + lib/escrow:
 *   accept / decline / submit / approve / cancel
 *
 * `accept` is kind-agnostic (gig vs exchange/p2p-order share the same
 * transition code), so the public-accept coverage includes one exchange
 * case alongside the gig cases to pin that down.
 *
 * The harness uses a fake chain registry, so buildTx returns FAKE_UNSIGNED
 * (no RPC). Real app via fastify.inject; gated on TEST_DATABASE_URL.
 */
import { test } from 'node:test'
import assert from 'node:assert'
import {
  TEST_DB_CONFIGURED, useTestApp, createUser, createEscrow, makeTransactable, authHeader,
  attachExchangeDetails,
} from '../helpers/test-app'
import { partiedEscrow } from '../helpers/escrow-states'

const skip = !TEST_DB_CONFIGURED
const getApp = useTestApp()

// ---------- accept ---------------------------------------------------------------

test('POST accept: 401 without a token', { skip }, async () => {
  const app = getApp()
  const creator = await createUser(app)
  const e = await createEscrow(app, { creator_id: creator.row.id, status: 'open' })
  const res = await app.inject({ method: 'POST', url: `/v1/escrows/${e.id}/accept` })
  assert.strictEqual(res.statusCode, 401)
})

test('POST accept: the assigned counterparty accepts an open escrow → unsigned tx', { skip }, async () => {
  const app = getApp()
  const creator = await createUser(app)
  const worker = await createUser(app)
  await makeTransactable(app, worker.row.id) // wallet + verified contact (9D gate)
  const e = await createEscrow(app, {
    creator_id: creator.row.id, status: 'open', assigned_counterparty_id: worker.row.id,
  })
  const res = await app.inject({
    method: 'POST', url: `/v1/escrows/${e.id}/accept`, headers: authHeader(worker.token),
  })
  assert.strictEqual(res.statusCode, 200)
  assert.ok(res.json().unsigned, 'returns an unsigned tx')
})

test('POST accept: a stranger accepts a public (unassigned) open escrow → unsigned tx', { skip }, async () => {
  const app = getApp()
  const creator = await createUser(app)
  const stranger = await createUser(app)
  await makeTransactable(app, stranger.row.id)
  const e = await createEscrow(app, { creator_id: creator.row.id, status: 'open' })
  const res = await app.inject({
    method: 'POST', url: `/v1/escrows/${e.id}/accept`, headers: authHeader(stranger.token),
  })
  assert.strictEqual(res.statusCode, 200)
  assert.ok(res.json().unsigned, 'returns an unsigned tx')
})

test('POST accept: a stranger takes a public (unassigned) exchange order → unsigned tx', { skip }, async () => {
  const app = getApp()
  const creator = await createUser(app)
  const taker = await createUser(app)
  await makeTransactable(app, taker.row.id)
  const e = await createEscrow(app, { creator_id: creator.row.id, status: 'open', kind: 'exchange' })
  await attachExchangeDetails(app, e.id)
  const res = await app.inject({
    method: 'POST', url: `/v1/escrows/${e.id}/accept`, headers: authHeader(taker.token),
  })
  assert.strictEqual(res.statusCode, 200)
  assert.ok(res.json().unsigned, 'returns an unsigned tx')
})

test('POST accept: the creator cannot accept their own public escrow', { skip }, async () => {
  const app = getApp()
  const creator = await createUser(app)
  const e = await createEscrow(app, { creator_id: creator.row.id, status: 'open' })
  const res = await app.inject({
    method: 'POST', url: `/v1/escrows/${e.id}/accept`, headers: authHeader(creator.token),
  })
  assert.strictEqual(res.statusCode, 403)
})

test('POST accept: the creator cannot accept their own escrow', { skip }, async () => {
  const app = getApp()
  const creator = await createUser(app)
  const worker = await createUser(app)
  const e = await createEscrow(app, {
    creator_id: creator.row.id, status: 'open', assigned_counterparty_id: worker.row.id,
  })
  const res = await app.inject({
    method: 'POST', url: `/v1/escrows/${e.id}/accept`, headers: authHeader(creator.token),
  })
  assert.strictEqual(res.statusCode, 403)
})

test('POST accept: a stranger cannot accept an escrow assigned to someone else', { skip }, async () => {
  const app = getApp()
  const creator = await createUser(app)
  const worker = await createUser(app)
  const stranger = await createUser(app)
  const e = await createEscrow(app, {
    creator_id: creator.row.id, status: 'open', assigned_counterparty_id: worker.row.id,
  })
  const res = await app.inject({
    method: 'POST', url: `/v1/escrows/${e.id}/accept`, headers: authHeader(stranger.token),
  })
  assert.strictEqual(res.statusCode, 403)
})

test('POST accept: 409 when the escrow is not open', { skip }, async () => {
  const app = getApp()
  const { worker, escrow } = await partiedEscrow(app, 'accepted')
  const res = await app.inject({
    method: 'POST', url: `/v1/escrows/${escrow.id}/accept`, headers: authHeader(worker.token),
  })
  assert.strictEqual(res.statusCode, 409)
})

// ---------- decline --------------------------------------------------------------

test('POST decline: the assigned counterparty declines an open escrow', { skip }, async () => {
  const app = getApp()
  const creator = await createUser(app)
  const worker = await createUser(app)
  const e = await createEscrow(app, {
    creator_id: creator.row.id, status: 'open', assigned_counterparty_id: worker.row.id,
  })
  const res = await app.inject({
    method: 'POST', url: `/v1/escrows/${e.id}/decline`, headers: authHeader(worker.token),
  })
  assert.strictEqual(res.statusCode, 200)
  assert.ok(res.json().unsigned)
})

// ---------- submit ---------------------------------------------------------------

// Accepted escrows always carry a completion_deadline in production (accept
// stamps it); set it so the submit window check (completion_deadline+grace)
// has a real date instead of null.
async function acceptedEscrow(app: ReturnType<typeof getApp>) {
  const creator = await createUser(app)
  const worker = await createUser(app)
  const escrow = await createEscrow(app, {
    creator_id: creator.row.id, counterparty_id: worker.row.id, status: 'accepted',
    completion_deadline: new Date(Date.now() + 86_400_000),
  })
  return { creator, worker, escrow }
}

test('POST submit: the counterparty submits an accepted escrow', { skip }, async () => {
  const app = getApp()
  const { worker, escrow } = await acceptedEscrow(app)
  const res = await app.inject({
    method: 'POST', url: `/v1/escrows/${escrow.id}/submit`, headers: authHeader(worker.token),
    payload: { proof_hash: `0x${'a'.repeat(64)}` },
  })
  assert.strictEqual(res.statusCode, 200)
  assert.ok(res.json().unsigned)
})

test('POST submit: the creator cannot submit (only the counterparty)', { skip }, async () => {
  const app = getApp()
  const { creator, escrow } = await acceptedEscrow(app)
  const res = await app.inject({
    method: 'POST', url: `/v1/escrows/${escrow.id}/submit`, headers: authHeader(creator.token),
    payload: { proof_hash: `0x${'a'.repeat(64)}` },
  })
  assert.strictEqual(res.statusCode, 403)
})

// ---------- approve --------------------------------------------------------------

test('POST approve: the creator approves a submitted escrow', { skip }, async () => {
  const app = getApp()
  const { creator, escrow } = await partiedEscrow(app, 'submitted')
  const res = await app.inject({
    method: 'POST', url: `/v1/escrows/${escrow.id}/approve`, headers: authHeader(creator.token),
  })
  assert.strictEqual(res.statusCode, 200)
  assert.ok(res.json().unsigned)
})

test('POST approve: the counterparty cannot approve', { skip }, async () => {
  const app = getApp()
  const { worker, escrow } = await partiedEscrow(app, 'submitted')
  const res = await app.inject({
    method: 'POST', url: `/v1/escrows/${escrow.id}/approve`, headers: authHeader(worker.token),
  })
  assert.strictEqual(res.statusCode, 403)
})

// ---------- cancel ---------------------------------------------------------------

test('POST cancel: the creator cancels an open escrow', { skip }, async () => {
  const app = getApp()
  const creator = await createUser(app)
  const e = await createEscrow(app, { creator_id: creator.row.id, status: 'open' })
  const res = await app.inject({
    method: 'POST', url: `/v1/escrows/${e.id}/cancel`, headers: authHeader(creator.token),
  })
  assert.strictEqual(res.statusCode, 200)
  assert.ok(res.json().unsigned)
})

test('POST cancel: a stranger cannot cancel', { skip }, async () => {
  const app = getApp()
  const creator = await createUser(app)
  const stranger = await createUser(app)
  const e = await createEscrow(app, { creator_id: creator.row.id, status: 'open' })
  const res = await app.inject({
    method: 'POST', url: `/v1/escrows/${e.id}/cancel`, headers: authHeader(stranger.token),
  })
  assert.strictEqual(res.statusCode, 403)
})

test('POST <transition>: 404 for an unknown escrow id', { skip }, async () => {
  const app = getApp()
  const u = await createUser(app)
  const res = await app.inject({
    method: 'POST', url: '/v1/escrows/00000000-0000-0000-0000-000000000000/accept',
    headers: authHeader(u.token),
  })
  assert.strictEqual(res.statusCode, 404)
})
