/**
 * CO2 route matrix — escrow lifecycle reads/writes:
 *   DELETE /v1/escrows/:id        (draft-only + pending-create TOCTOU guard)
 *   GET    /v1/escrows/:id        (caller derivation)
 *   POST/GET /v1/escrows/:id/proofs (status/counterparty guards + total cap)
 *
 * Real app via fastify.inject; gated on TEST_DATABASE_URL (helpers/test-app).
 */
import { test } from 'node:test'
import assert from 'node:assert'
import { eq } from 'drizzle-orm'
import { escrows, tx_attempts } from '@tenda/shared/db/schema'
import {
  TEST_DB_CONFIGURED,
  useTestApp,
  createUser,
  createEscrow,
  authHeader,
} from '../helpers/test-app'
import { partiedEscrow, proofUrl } from '../helpers/escrow-states'

const skip = !TEST_DB_CONFIGURED
const getApp = useTestApp()

// ---------- DELETE /v1/escrows/:id ---------------------------------------------

test('DELETE /v1/escrows/:id: 403 for a non-creator', { skip }, async () => {
  const app = getApp()
  const creator = await createUser(app)
  const stranger = await createUser(app)
  const escrow = await createEscrow(app, { creator_id: creator.row.id })
  const res = await app.inject({
    method: 'DELETE',
    url: `/v1/escrows/${escrow.id}`,
    headers: authHeader(stranger.token),
  })
  assert.strictEqual(res.statusCode, 403)
})

test('DELETE /v1/escrows/:id: 409 once published', { skip }, async () => {
  const app = getApp()
  const u = await createUser(app)
  const escrow = await createEscrow(app, { creator_id: u.row.id, status: 'open' })
  const res = await app.inject({
    method: 'DELETE',
    url: `/v1/escrows/${escrow.id}`,
    headers: authHeader(u.token),
  })
  assert.strictEqual(res.statusCode, 409)
})

test('DELETE /v1/escrows/:id: 409 while a create ping is unsettled', { skip }, async () => {
  const app = getApp()
  const u = await createUser(app)
  const escrow = await createEscrow(app, { creator_id: u.row.id })
  await app.db.insert(tx_attempts).values({
    user_id: u.row.id,
    escrow_id: escrow.id,
    action: 'create',
    tx_ref: `sig-pending-${escrow.id}`,
  })
  const res = await app.inject({
    method: 'DELETE',
    url: `/v1/escrows/${escrow.id}`,
    headers: authHeader(u.token),
  })
  assert.strictEqual(res.statusCode, 409)
})

test('DELETE /v1/escrows/:id: a FAILED create ping does not block, row is gone', { skip }, async () => {
  const app = getApp()
  const u = await createUser(app)
  const escrow = await createEscrow(app, { creator_id: u.row.id })
  await app.db.insert(tx_attempts).values({
    user_id: u.row.id,
    escrow_id: escrow.id,
    action: 'create',
    tx_ref: `sig-failed-${escrow.id}`,
    failed_at: new Date(),
    failure_code: 'tx_failed',
  })
  const res = await app.inject({
    method: 'DELETE',
    url: `/v1/escrows/${escrow.id}`,
    headers: authHeader(u.token),
  })
  assert.strictEqual(res.statusCode, 200)
  const rows = await app.db.select().from(escrows).where(eq(escrows.id, escrow.id))
  assert.strictEqual(rows.length, 0)
})

// ---------- GET /v1/escrows/:id --------------------------------------------------

test('GET /v1/escrows/:id: 403 for a stranger, 200 for a dispute_admin', { skip }, async () => {
  const app = getApp()
  const creator = await createUser(app)
  const stranger = await createUser(app)
  const admin = await createUser(app, { role: 'dispute_admin' })
  const escrow = await createEscrow(app, { creator_id: creator.row.id })

  const denied = await app.inject({
    method: 'GET',
    url: `/v1/escrows/${escrow.id}`,
    headers: authHeader(stranger.token),
  })
  assert.strictEqual(denied.statusCode, 403)

  const allowed = await app.inject({
    method: 'GET',
    url: `/v1/escrows/${escrow.id}`,
    headers: authHeader(admin.token),
  })
  assert.strictEqual(allowed.statusCode, 200)
  assert.strictEqual(allowed.json().escrow.id, escrow.id)
})

// ---------- proofs ----------------------------------------------------------------

test('POST proofs: 409 while the escrow is open', { skip }, async () => {
  const app = getApp()
  const creator = await createUser(app)
  const worker = await createUser(app)
  const escrow = await createEscrow(app, { creator_id: creator.row.id, status: 'open' })
  const res = await app.inject({
    method: 'POST',
    url: `/v1/escrows/${escrow.id}/proofs`,
    headers: authHeader(worker.token),
    payload: { proofs: [{ url: proofUrl(worker.row.id, 1), type: 'image' }] },
  })
  assert.strictEqual(res.statusCode, 409)
})

test('POST proofs: 403 for anyone but the counterparty (creator included)', { skip }, async () => {
  const app = getApp()
  const { creator, escrow } = await partiedEscrow(app, 'accepted')
  const res = await app.inject({
    method: 'POST',
    url: `/v1/escrows/${escrow.id}/proofs`,
    headers: authHeader(creator.token),
    payload: { proofs: [{ url: proofUrl(creator.row.id, 1), type: 'image' }] },
  })
  assert.strictEqual(res.statusCode, 403)
})

test('POST proofs: 400 on an empty batch', { skip }, async () => {
  const app = getApp()
  const { worker, escrow } = await partiedEscrow(app, 'accepted')
  const res = await app.inject({
    method: 'POST',
    url: `/v1/escrows/${escrow.id}/proofs`,
    headers: authHeader(worker.token),
    payload: { proofs: [] },
  })
  assert.strictEqual(res.statusCode, 400)
})

test('POST proofs: 400 on a foreign-folder Cloudinary URL', { skip }, async () => {
  const app = getApp()
  const { creator, worker, escrow } = await partiedEscrow(app, 'accepted')
  const res = await app.inject({
    method: 'POST',
    url: `/v1/escrows/${escrow.id}/proofs`,
    headers: authHeader(worker.token),
    payload: { proofs: [{ url: proofUrl(creator.row.id, 1), type: 'image' }] },
  })
  assert.strictEqual(res.statusCode, 400)
})

test('POST proofs: total cap of 20 holds across submissions', { skip }, async () => {
  const app = getApp()
  const { worker, escrow } = await partiedEscrow(app, 'accepted')
  const batch = (from: number, n: number) => ({
    proofs: Array.from({ length: n }, (_, i) => ({
      url: proofUrl(worker.row.id, from + i),
      type: 'image',
    })),
  })
  const first = await app.inject({
    method: 'POST',
    url: `/v1/escrows/${escrow.id}/proofs`,
    headers: authHeader(worker.token),
    payload: batch(0, 19),
  })
  assert.strictEqual(first.statusCode, 201)
  const overflow = await app.inject({
    method: 'POST',
    url: `/v1/escrows/${escrow.id}/proofs`,
    headers: authHeader(worker.token),
    payload: batch(19, 2),
  })
  assert.strictEqual(overflow.statusCode, 400)
  const exact = await app.inject({
    method: 'POST',
    url: `/v1/escrows/${escrow.id}/proofs`,
    headers: authHeader(worker.token),
    payload: batch(19, 1),
  })
  assert.strictEqual(exact.statusCode, 201)
})

test('GET proofs: parties read, strangers 403', { skip }, async () => {
  const app = getApp()
  const { creator, worker, escrow } = await partiedEscrow(app, 'accepted')
  const stranger = await createUser(app)
  await app.inject({
    method: 'POST',
    url: `/v1/escrows/${escrow.id}/proofs`,
    headers: authHeader(worker.token),
    payload: { proofs: [{ url: proofUrl(worker.row.id, 1), type: 'image' }] },
  })
  const ok = await app.inject({
    method: 'GET',
    url: `/v1/escrows/${escrow.id}/proofs`,
    headers: authHeader(creator.token),
  })
  assert.strictEqual(ok.statusCode, 200)
  assert.strictEqual(ok.json().length, 1)
  const denied = await app.inject({
    method: 'GET',
    url: `/v1/escrows/${escrow.id}/proofs`,
    headers: authHeader(stranger.token),
  })
  assert.strictEqual(denied.statusCode, 403)
})
