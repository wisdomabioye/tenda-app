/**
 * CO7 shared mediation thread (#77) — /v1/escrows/:id/dispute/messages:
 * parties + mediators read ONE conversation; parties post while
 * unresolved; admins post only while holding the claim; resolved threads
 * freeze read-only; GET advances the caller's read cursor.
 *
 * Real app via fastify.inject; gated on TEST_DATABASE_URL (helpers/test-app).
 */
import { test } from 'node:test'
import assert from 'node:assert'
import { eq } from 'drizzle-orm'
import { disputes } from '@tenda/shared/db/schema'
import {
  TEST_DB_CONFIGURED,
  useTestApp,
  createUser,
  createEscrow,
  attachGigDetails,
  authHeader,
} from '../helpers/test-app'
import { disputedEscrow } from '../helpers/escrow-states'

const skip = !TEST_DB_CONFIGURED
const getApp = useTestApp()

function threadUrl(escrowId: string, after?: string): string {
  return `/v1/escrows/${escrowId}/dispute/messages${after !== undefined ? `?after=${encodeURIComponent(after)}` : ''}`
}

test('thread: 404 without a dispute, 403 for strangers', { skip }, async () => {
  const app = getApp()
  const creator = await createUser(app)
  const escrow = await createEscrow(app, { creator_id: creator.row.id, status: 'accepted' })
  const none = await app.inject({
    method: 'GET',
    url: threadUrl(escrow.id),
    headers: authHeader(creator.token),
  })
  assert.strictEqual(none.statusCode, 404)

  const { escrow: disputed } = await disputedEscrow(app)
  const stranger = await createUser(app)
  const denied = await app.inject({
    method: 'GET',
    url: threadUrl(disputed.id),
    headers: authHeader(stranger.token),
  })
  assert.strictEqual(denied.statusCode, 403)
})

test('thread: both parties + mediator share one conversation', { skip }, async () => {
  const app = getApp()
  const { creator, worker, escrow, dispute_id } = await disputedEscrow(app)
  const mediator = await createUser(app, { role: 'dispute_admin' })
  await app.inject({
    method: 'POST',
    url: `/v1/admin/disputes/${dispute_id}/claim`,
    headers: authHeader(mediator.token),
  })

  const fromCreator = await app.inject({
    method: 'POST',
    url: threadUrl(escrow.id),
    headers: authHeader(creator.token),
    payload: { body: 'The work was never delivered.' },
  })
  assert.strictEqual(fromCreator.statusCode, 201)

  const fromMediator = await app.inject({
    method: 'POST',
    url: threadUrl(escrow.id),
    headers: authHeader(mediator.token),
    payload: { body: 'Reviewing the evidence from both sides now.' },
  })
  assert.strictEqual(fromMediator.statusCode, 201)

  const seenByWorker = await app.inject({
    method: 'GET',
    url: threadUrl(escrow.id),
    headers: authHeader(worker.token),
  })
  assert.strictEqual(seenByWorker.statusCode, 200)
  const thread = seenByWorker.json()
  assert.strictEqual(thread.dispute_id, dispute_id)
  assert.strictEqual(thread.assigned_to_id, mediator.row.id)
  assert.strictEqual(thread.read_only, false)
  assert.deepStrictEqual(
    thread.messages.map((m: { sender_id: string }) => m.sender_id),
    [creator.row.id, mediator.row.id],
  )
  // the GET advanced the worker's read cursor
  const readers = thread.reads.map((r: { user_id: string }) => r.user_id)
  assert.ok(readers.includes(worker.row.id))
})

test('thread: full load carries escrow + party context, creator-first', { skip }, async () => {
  const app = getApp()
  const { creator, worker, escrow } = await disputedEscrow(app)
  await attachGigDetails(app, escrow.id, { title: 'Fix my leaking tap' })

  const res = await app.inject({
    method: 'GET',
    url: threadUrl(escrow.id),
    headers: authHeader(worker.token),
  })
  assert.strictEqual(res.statusCode, 200)
  const { context } = res.json()
  assert.notStrictEqual(context, null)
  assert.strictEqual(context.kind, 'gig')
  assert.strictEqual(context.status, 'disputed')
  assert.strictEqual(context.subject_title, 'Fix my leaking tap')
  assert.strictEqual(context.reason, 'Work was never delivered as agreed')
  assert.strictEqual(context.winner, null)
  assert.strictEqual(context.resolved_at, null)
  // creator-first ordering, kind-agnostic structural roles, raiser marked.
  assert.deepStrictEqual(
    context.parties.map((p: { role: string; user_id: string; raised_dispute: boolean }) => ({
      role: p.role,
      user_id: p.user_id,
      raised_dispute: p.raised_dispute,
    })),
    [
      { role: 'creator', user_id: creator.row.id, raised_dispute: true },
      { role: 'counterparty', user_id: worker.row.id, raised_dispute: false },
    ],
  )
})

test('thread: exchange context has a null subject_title (no gig details)', { skip }, async () => {
  const app = getApp()
  const creator = await createUser(app)
  const worker = await createUser(app)
  const escrow = await createEscrow(app, {
    kind: 'exchange',
    creator_id: creator.row.id,
    counterparty_id: worker.row.id,
    status: 'disputed',
  })
  await app.db
    .insert(disputes)
    .values({ escrow_id: escrow.id, raised_by: worker.row.id, reason: 'Paid but the seller never released' })

  const res = await app.inject({
    method: 'GET',
    url: threadUrl(escrow.id),
    headers: authHeader(creator.token),
  })
  const { context } = res.json()
  assert.strictEqual(context.kind, 'exchange')
  assert.strictEqual(context.subject_title, null)
  // Raiser marker follows the actual raiser (the worker here), not creator-first.
  const worker_party = context.parties.find((p: { role: string }) => p.role === 'counterparty')
  assert.strictEqual(worker_party.raised_dispute, true)
})

test('thread: ?after tail polls omit the context (client keeps the first copy)', { skip }, async () => {
  const app = getApp()
  const { creator, escrow } = await disputedEscrow(app)
  const first = await app.inject({
    method: 'POST',
    url: threadUrl(escrow.id),
    headers: authHeader(creator.token),
    payload: { body: 'opening statement' },
  })
  const cursor = first.json().created_at

  const tail = await app.inject({
    method: 'GET',
    url: threadUrl(escrow.id, cursor),
    headers: authHeader(creator.token),
  })
  assert.strictEqual(tail.statusCode, 200)
  assert.strictEqual(tail.json().context, null)
})

test('thread: resolved context reports winner + resolved_at', { skip }, async () => {
  const app = getApp()
  const { worker, escrow, dispute_id } = await disputedEscrow(app)
  const admin = await createUser(app, { role: 'super_admin' })
  await app.db
    .update(disputes)
    .set({ resolved_at: new Date(), resolved_by: admin.row.id, winner: 'creator' })
    .where(eq(disputes.id, dispute_id))

  const res = await app.inject({
    method: 'GET',
    url: threadUrl(escrow.id),
    headers: authHeader(worker.token),
  })
  const { context } = res.json()
  assert.strictEqual(context.winner, 'creator')
  assert.notStrictEqual(context.resolved_at, null)
})

test('thread: unclaimed admins read but cannot post', { skip }, async () => {
  const app = getApp()
  const { escrow } = await disputedEscrow(app)
  const observer = await createUser(app, { role: 'dispute_admin' })

  const read = await app.inject({
    method: 'GET',
    url: threadUrl(escrow.id),
    headers: authHeader(observer.token),
  })
  assert.strictEqual(read.statusCode, 200)

  const post = await app.inject({
    method: 'POST',
    url: threadUrl(escrow.id),
    headers: authHeader(observer.token),
    payload: { body: 'I have thoughts about this dispute.' },
  })
  assert.strictEqual(post.statusCode, 403)
})

test('thread: body validation — empty and over-length rejected', { skip }, async () => {
  const app = getApp()
  const { creator, escrow } = await disputedEscrow(app)
  const empty = await app.inject({
    method: 'POST',
    url: threadUrl(escrow.id),
    headers: authHeader(creator.token),
    payload: { body: '   ' },
  })
  assert.strictEqual(empty.statusCode, 400)
  const long = await app.inject({
    method: 'POST',
    url: threadUrl(escrow.id),
    headers: authHeader(creator.token),
    payload: { body: 'x'.repeat(2001) },
  })
  assert.strictEqual(long.statusCode, 400)
})

test('thread: ?after returns only the tail', { skip }, async () => {
  const app = getApp()
  const { creator, worker, escrow } = await disputedEscrow(app)
  const first = await app.inject({
    method: 'POST',
    url: threadUrl(escrow.id),
    headers: authHeader(creator.token),
    payload: { body: 'first message' },
  })
  const cursor = first.json().created_at
  await app.inject({
    method: 'POST',
    url: threadUrl(escrow.id),
    headers: authHeader(worker.token),
    payload: { body: 'second message' },
  })

  const tail = await app.inject({
    method: 'GET',
    url: threadUrl(escrow.id, cursor),
    headers: authHeader(creator.token),
  })
  // gte: the boundary message echoes (client dedupes by id) so same-ms
  // siblings can never be skipped — the tail is [boundary, newer].
  assert.deepStrictEqual(
    tail.json().messages.map((m: { body: string }) => m.body),
    ['first message', 'second message'],
  )

  const bad = await app.inject({
    method: 'GET',
    url: threadUrl(escrow.id, 'not-a-date'),
    headers: authHeader(creator.token),
  })
  assert.strictEqual(bad.statusCode, 400)
})

test('thread: resolved disputes freeze read-only', { skip }, async () => {
  const app = getApp()
  const { creator, worker, escrow, dispute_id } = await disputedEscrow(app)
  await app.inject({
    method: 'POST',
    url: threadUrl(escrow.id),
    headers: authHeader(creator.token),
    payload: { body: 'pre-resolution message' },
  })
  const admin = await createUser(app, { role: 'super_admin' })
  await app.db
    .update(disputes)
    .set({ resolved_at: new Date(), resolved_by: admin.row.id, winner: 'creator' })
    .where(eq(disputes.id, dispute_id))

  const frozen = await app.inject({
    method: 'POST',
    url: threadUrl(escrow.id),
    headers: authHeader(worker.token),
    payload: { body: 'too late' },
  })
  assert.strictEqual(frozen.statusCode, 409)
  assert.strictEqual(frozen.json().code, 'DISPUTE_RESOLVED')

  const stillReadable = await app.inject({
    method: 'GET',
    url: threadUrl(escrow.id),
    headers: authHeader(worker.token),
  })
  assert.strictEqual(stillReadable.statusCode, 200)
  assert.strictEqual(stillReadable.json().read_only, true)
  assert.strictEqual(stillReadable.json().messages.length, 1)
})
