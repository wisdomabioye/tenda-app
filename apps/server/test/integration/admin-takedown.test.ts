/**
 * CO1 admin takedown (#70): PATCH /v1/admin/escrows/:id/hidden flips
 * escrows.hidden; hidden listings vanish from the public gig feed, the
 * exchange order book, and public detail — but stay visible to their
 * parties and to admins, and keep appearing in mine=.
 *
 * Real app via fastify.inject; gated on TEST_DATABASE_URL (helpers/test-app).
 */
import { test } from 'node:test'
import assert from 'node:assert'
import {
  TEST_DB_CONFIGURED,
  useTestApp,
  createUser,
  createEscrow,
  attachExchangeDetails,
  authHeader,
} from '../helpers/test-app'
import { openGig } from '../helpers/escrow-states'

const skip = !TEST_DB_CONFIGURED
const getApp = useTestApp()

function hideUrl(id: string): string {
  return `/v1/admin/escrows/${id}/hidden`
}

test('takedown: only escrows.takedown holders may toggle', { skip }, async () => {
  const app = getApp()
  const { escrow } = await openGig(app)
  const disputeAdmin = await createUser(app, { role: 'dispute_admin' })
  const user = await createUser(app)

  const lesser = await app.inject({
    method: 'PATCH',
    url: hideUrl(escrow.id),
    headers: authHeader(disputeAdmin.token),
    payload: { hidden: true },
  })
  assert.strictEqual(lesser.statusCode, 403)

  const plain = await app.inject({
    method: 'PATCH',
    url: hideUrl(escrow.id),
    headers: authHeader(user.token),
    payload: { hidden: true },
  })
  assert.strictEqual(plain.statusCode, 403)
})

test('takedown: 404 unknown escrow, 400 non-boolean body', { skip }, async () => {
  const app = getApp()
  const admin = await createUser(app, { role: 'super_admin' })
  const missing = await app.inject({
    method: 'PATCH',
    url: hideUrl('f0e36d8a-0000-0000-0000-000000000000'),
    headers: authHeader(admin.token),
    payload: { hidden: true },
  })
  assert.strictEqual(missing.statusCode, 404)

  const { escrow } = await openGig(app)
  const bad = await app.inject({
    method: 'PATCH',
    url: hideUrl(escrow.id),
    headers: authHeader(admin.token),
    payload: { hidden: 'yes' },
  })
  assert.strictEqual(bad.statusCode, 400)
})

test('takedown: hidden gig leaves the feed, unhide restores it', { skip }, async () => {
  const app = getApp()
  const { escrow } = await openGig(app)
  const admin = await createUser(app, { role: 'super_admin' })

  const hide = await app.inject({
    method: 'PATCH',
    url: hideUrl(escrow.id),
    headers: authHeader(admin.token),
    payload: { hidden: true },
  })
  assert.strictEqual(hide.statusCode, 200)
  assert.deepStrictEqual(hide.json(), { id: escrow.id, hidden: true })

  const hiddenFeed = await app.inject({ method: 'GET', url: '/v1/gigs' })
  assert.strictEqual(hiddenFeed.json().total, 0)

  const unhide = await app.inject({
    method: 'PATCH',
    url: hideUrl(escrow.id),
    headers: authHeader(admin.token),
    payload: { hidden: false },
  })
  assert.strictEqual(unhide.statusCode, 200)
  const restored = await app.inject({ method: 'GET', url: '/v1/gigs' })
  assert.strictEqual(restored.json().total, 1)
})

test('takedown: hidden gig detail — 404 public, 200 creator/admin, mine= keeps it', { skip }, async () => {
  const app = getApp()
  const { creator, escrow } = await openGig(app)
  const admin = await createUser(app, { role: 'super_admin' })
  const stranger = await createUser(app)
  await app.inject({
    method: 'PATCH',
    url: hideUrl(escrow.id),
    headers: authHeader(admin.token),
    payload: { hidden: true },
  })

  const anon = await app.inject({ method: 'GET', url: `/v1/gigs/${escrow.id}` })
  assert.strictEqual(anon.statusCode, 404)
  const other = await app.inject({
    method: 'GET',
    url: `/v1/gigs/${escrow.id}`,
    headers: authHeader(stranger.token),
  })
  assert.strictEqual(other.statusCode, 404)

  const own = await app.inject({
    method: 'GET',
    url: `/v1/gigs/${escrow.id}`,
    headers: authHeader(creator.token),
  })
  assert.strictEqual(own.statusCode, 200)
  const adminView = await app.inject({
    method: 'GET',
    url: `/v1/gigs/${escrow.id}`,
    headers: authHeader(admin.token),
  })
  assert.strictEqual(adminView.statusCode, 200)

  const mine = await app.inject({
    method: 'GET',
    url: '/v1/gigs?mine=created',
    headers: authHeader(creator.token),
  })
  assert.strictEqual(mine.json().total, 1)
})

test('takedown: hidden exchange offer leaves the order book + detail 404s', { skip }, async () => {
  const app = getApp()
  const creator = await createUser(app)
  const stranger = await createUser(app)
  const admin = await createUser(app, { role: 'super_admin' })
  const escrow = await createEscrow(app, {
    creator_id: creator.row.id,
    kind: 'exchange',
    status: 'open',
  })
  await attachExchangeDetails(app, escrow.id)

  const before = await app.inject({
    method: 'GET',
    url: '/v1/exchange',
    headers: authHeader(stranger.token),
  })
  assert.strictEqual(before.json().total, 1)

  await app.inject({
    method: 'PATCH',
    url: hideUrl(escrow.id),
    headers: authHeader(admin.token),
    payload: { hidden: true },
  })

  const after = await app.inject({
    method: 'GET',
    url: '/v1/exchange',
    headers: authHeader(stranger.token),
  })
  assert.strictEqual(after.json().total, 0)

  const detail = await app.inject({
    method: 'GET',
    url: `/v1/exchange/${escrow.id}`,
    headers: authHeader(stranger.token),
  })
  assert.strictEqual(detail.statusCode, 404)
  const own = await app.inject({
    method: 'GET',
    url: `/v1/exchange/${escrow.id}`,
    headers: authHeader(creator.token),
  })
  assert.strictEqual(own.statusCode, 200)
})

test('takedown: admin escrow browser surfaces the hidden flag', { skip }, async () => {
  const app = getApp()
  const { escrow } = await openGig(app)
  const admin = await createUser(app, { role: 'super_admin' })
  await app.inject({
    method: 'PATCH',
    url: hideUrl(escrow.id),
    headers: authHeader(admin.token),
    payload: { hidden: true },
  })
  const res = await app.inject({
    method: 'GET',
    url: `/v1/admin/escrows/${escrow.id}`,
    headers: authHeader(admin.token),
  })
  assert.strictEqual(res.statusCode, 200)
  assert.strictEqual(res.json().hidden, true)
})
