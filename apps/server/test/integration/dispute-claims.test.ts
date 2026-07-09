/**
 * CO7 claim-based dispute assignment (#77):
 *   POST /v1/admin/disputes/:id/claim — atomic take from the open pool
 *   POST /v1/admin/disputes/:id/release — claimer (or super_admin) returns it
 *   GET  /v1/admin/disputes?assigned=me|none — caseload vs pool views
 *
 * Real app via fastify.inject; gated on TEST_DATABASE_URL (helpers/test-app).
 */
import { test } from 'node:test'
import assert from 'node:assert'
import { eq } from 'drizzle-orm'
import { disputes } from '@tenda/shared/db/schema'
import { TEST_DB_CONFIGURED, useTestApp, createUser, authHeader } from '../helpers/test-app'
import { disputedEscrow } from '../helpers/escrow-states'

const skip = !TEST_DB_CONFIGURED
const getApp = useTestApp()

test('claim: takes an open dispute; rival claim 409; self re-claim 200', { skip }, async () => {
  const app = getApp()
  const { dispute_id } = await disputedEscrow(app)
  const mediator = await createUser(app, { role: 'dispute_admin' })
  const rival = await createUser(app, { role: 'dispute_admin' })

  const claim = await app.inject({
    method: 'POST',
    url: `/v1/admin/disputes/${dispute_id}/claim`,
    headers: authHeader(mediator.token),
  })
  assert.strictEqual(claim.statusCode, 200)
  assert.strictEqual(claim.json().assigned_to_id, mediator.row.id)

  const contested = await app.inject({
    method: 'POST',
    url: `/v1/admin/disputes/${dispute_id}/claim`,
    headers: authHeader(rival.token),
  })
  assert.strictEqual(contested.statusCode, 409)
  assert.strictEqual(contested.json().code, 'DISPUTE_ALREADY_CLAIMED')

  const again = await app.inject({
    method: 'POST',
    url: `/v1/admin/disputes/${dispute_id}/claim`,
    headers: authHeader(mediator.token),
  })
  assert.strictEqual(again.statusCode, 200)
})

test('claim: 404 unknown, 409 resolved, 403 plain user', { skip }, async () => {
  const app = getApp()
  const mediator = await createUser(app, { role: 'dispute_admin' })
  const missing = await app.inject({
    method: 'POST',
    url: '/v1/admin/disputes/f0e36d8a-0000-0000-0000-000000000000/claim',
    headers: authHeader(mediator.token),
  })
  assert.strictEqual(missing.statusCode, 404)

  const { dispute_id, creator } = await disputedEscrow(app)
  await app.db
    .update(disputes)
    .set({ resolved_at: new Date(), resolved_by: mediator.row.id, winner: 'creator' })
    .where(eq(disputes.id, dispute_id))
  const resolved = await app.inject({
    method: 'POST',
    url: `/v1/admin/disputes/${dispute_id}/claim`,
    headers: authHeader(mediator.token),
  })
  assert.strictEqual(resolved.statusCode, 409)
  assert.strictEqual(resolved.json().code, 'DISPUTE_RESOLVED')

  const plain = await app.inject({
    method: 'POST',
    url: `/v1/admin/disputes/${dispute_id}/claim`,
    headers: authHeader(creator.token),
  })
  assert.strictEqual(plain.statusCode, 403)
})

test('release: claimer releases; rival 403; super_admin force-releases; idempotent', { skip }, async () => {
  const app = getApp()
  const { dispute_id } = await disputedEscrow(app)
  const mediator = await createUser(app, { role: 'dispute_admin' })
  const rival = await createUser(app, { role: 'dispute_admin' })
  const root = await createUser(app, { role: 'super_admin' })
  const claimUrl = `/v1/admin/disputes/${dispute_id}/claim`
  const releaseUrl = `/v1/admin/disputes/${dispute_id}/release`

  await app.inject({ method: 'POST', url: claimUrl, headers: authHeader(mediator.token) })

  const denied = await app.inject({ method: 'POST', url: releaseUrl, headers: authHeader(rival.token) })
  assert.strictEqual(denied.statusCode, 403)

  const released = await app.inject({ method: 'POST', url: releaseUrl, headers: authHeader(mediator.token) })
  assert.strictEqual(released.statusCode, 200)
  assert.strictEqual(released.json().assigned_to_id, null)

  // idempotent re-release of an unclaimed dispute
  const again = await app.inject({ method: 'POST', url: releaseUrl, headers: authHeader(mediator.token) })
  assert.strictEqual(again.statusCode, 200)

  // super_admin can force-release someone else's claim
  await app.inject({ method: 'POST', url: claimUrl, headers: authHeader(mediator.token) })
  const forced = await app.inject({ method: 'POST', url: releaseUrl, headers: authHeader(root.token) })
  assert.strictEqual(forced.statusCode, 200)
})

test('list: assigned=me and assigned=none partition the queue', { skip }, async () => {
  const app = getApp()
  const a = await disputedEscrow(app)
  await disputedEscrow(app)
  const mediator = await createUser(app, { role: 'dispute_admin' })
  await app.inject({
    method: 'POST',
    url: `/v1/admin/disputes/${a.dispute_id}/claim`,
    headers: authHeader(mediator.token),
  })

  const mine = await app.inject({
    method: 'GET',
    url: '/v1/admin/disputes?assigned=me',
    headers: authHeader(mediator.token),
  })
  assert.strictEqual(mine.json().total, 1)
  assert.strictEqual(mine.json().data[0].dispute_id, a.dispute_id)
  assert.strictEqual(mine.json().data[0].assigned_to_id, mediator.row.id)

  const pool = await app.inject({
    method: 'GET',
    url: '/v1/admin/disputes?assigned=none',
    headers: authHeader(mediator.token),
  })
  assert.strictEqual(pool.json().total, 1)
  assert.notStrictEqual(pool.json().data[0].dispute_id, a.dispute_id)
})

test('list: party filters to every dispute a given user is involved in', { skip }, async () => {
  const app = getApp()
  const mine = await disputedEscrow(app)
  await disputedEscrow(app) // unrelated dispute, must not match
  const admin = await createUser(app, { role: 'dispute_admin' })

  // The creator is a party.
  const byCreator = await app.inject({
    method: 'GET',
    url: `/v1/admin/disputes?party=${mine.creator.row.id}`,
    headers: authHeader(admin.token),
  })
  assert.strictEqual(byCreator.json().total, 1)
  assert.strictEqual(byCreator.json().data[0].dispute_id, mine.dispute_id)

  // The worker (counterparty) is a party too.
  const byWorker = await app.inject({
    method: 'GET',
    url: `/v1/admin/disputes?party=${mine.worker.row.id}`,
    headers: authHeader(admin.token),
  })
  assert.strictEqual(byWorker.json().total, 1)
  assert.strictEqual(byWorker.json().data[0].dispute_id, mine.dispute_id)

  // A user party to nothing gets an empty queue.
  const stranger = await createUser(app)
  const none = await app.inject({
    method: 'GET',
    url: `/v1/admin/disputes?party=${stranger.row.id}`,
    headers: authHeader(admin.token),
  })
  assert.strictEqual(none.json().total, 0)
})

// ── A15 (#81): demotion auto-releases claimed disputes ──────────────────────

test('demotion: role losing disputes.mediate releases unresolved claims, keeps resolved', { skip }, async () => {
  const app = getApp()
  const root = await createUser(app, { role: 'super_admin' })
  const mediator = await createUser(app, { role: 'dispute_admin' })
  const live = await disputedEscrow(app)
  const closed = await disputedEscrow(app)

  for (const d of [live, closed]) {
    const claim = await app.inject({
      method: 'POST',
      url: `/v1/admin/disputes/${d.dispute_id}/claim`,
      headers: authHeader(mediator.token),
    })
    assert.strictEqual(claim.statusCode, 200)
  }
  // Resolve one while still claimed — its assignee is audit history.
  await app.db
    .update(disputes)
    .set({ resolved_at: new Date(), resolved_by: mediator.row.id, winner: 'creator' })
    .where(eq(disputes.id, closed.dispute_id))

  const demote = await app.inject({
    method: 'PATCH',
    url: `/v1/admin/users/${mediator.row.id}/role`,
    headers: authHeader(root.token),
    payload: { role: 'user' },
  })
  assert.strictEqual(demote.statusCode, 200)
  assert.strictEqual(demote.json().role, 'user')

  const [liveRow] = await app.db.select().from(disputes).where(eq(disputes.id, live.dispute_id))
  assert.strictEqual(liveRow.assigned_to, null)
  assert.strictEqual(liveRow.assigned_at, null)

  const [closedRow] = await app.db.select().from(disputes).where(eq(disputes.id, closed.dispute_id))
  assert.strictEqual(closedRow.assigned_to, mediator.row.id)

  // The released dispute is back in the open pool for other mediators.
  const other = await createUser(app, { role: 'dispute_admin' })
  const pool = await app.inject({
    method: 'GET',
    url: '/v1/admin/disputes?assigned=none',
    headers: authHeader(other.token),
  })
  const poolIds = pool.json().data.map((d: { dispute_id: string }) => d.dispute_id)
  assert.ok(poolIds.includes(live.dispute_id))
  assert.ok(!poolIds.includes(closed.dispute_id))
})

// A7 (review pass): the resolve builder is guarded in the HANDLER (caller
// derivation + state machine), not by an /admin prefix — pin it over HTTP.
test('resolve: parties and outsiders 403; dispute_admin receives the unsigned tx', { skip }, async () => {
  const app = getApp()
  const { escrow, creator } = await disputedEscrow(app)
  const outsider = await createUser(app)
  const mediator = await createUser(app, { role: 'dispute_admin' })
  const resolve = (token: string) =>
    app.inject({
      method: 'POST',
      url: `/v1/escrows/${escrow.id}/resolve`,
      headers: authHeader(token),
      payload: { winner: 'creator' },
    })

  assert.strictEqual((await resolve(creator.token)).statusCode, 403)
  assert.strictEqual((await resolve(outsider.token)).statusCode, 403)

  const ok = await resolve(mediator.token)
  assert.strictEqual(ok.statusCode, 200)
  assert.ok(ok.json().unsigned, 'dispute_admin gets the unsigned resolve tx')
})

test('demotion: role change that keeps disputes.mediate leaves claims intact', { skip }, async () => {
  const app = getApp()
  const root = await createUser(app, { role: 'super_admin' })
  const mediator = await createUser(app, { role: 'super_admin' })
  const { dispute_id } = await disputedEscrow(app)

  await app.inject({
    method: 'POST',
    url: `/v1/admin/disputes/${dispute_id}/claim`,
    headers: authHeader(mediator.token),
  })

  const lateral = await app.inject({
    method: 'PATCH',
    url: `/v1/admin/users/${mediator.row.id}/role`,
    headers: authHeader(root.token),
    payload: { role: 'dispute_admin' },
  })
  assert.strictEqual(lateral.statusCode, 200)

  const [row] = await app.db.select().from(disputes).where(eq(disputes.id, dispute_id))
  assert.strictEqual(row.assigned_to, mediator.row.id)
})
