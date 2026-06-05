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
