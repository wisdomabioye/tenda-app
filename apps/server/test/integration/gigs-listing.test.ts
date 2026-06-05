/**
 * CO2 route matrix — public feed + my-gigs + device-token pruning:
 *   GET /v1/gigs       (status/deadline visibility, filters, search)
 *   GET /v1/gigs?mine= (full authenticate incl. suspended rejection)
 *   workers/processors removeTokens (provider-dead push-token pruning)
 *
 * Real app via fastify.inject; gated on TEST_DATABASE_URL (helpers/test-app).
 */
import { test } from 'node:test'
import assert from 'node:assert'
import { eq } from 'drizzle-orm'
import { device_tokens } from '@tenda/shared/db/schema'
import { removeTokens } from '@server/workers/processors'
import {
  TEST_DB_CONFIGURED,
  useTestApp,
  createUser,
  createEscrow,
  attachGigDetails,
  authHeader,
} from '../helpers/test-app'
import { openGig } from '../helpers/escrow-states'

const skip = !TEST_DB_CONFIGURED
const getApp = useTestApp()

// ---------- public feed ---------------------------------------------------------

test('GET /v1/gigs: public feed hides drafts and stale deadlines', { skip }, async () => {
  const app = getApp()
  const { escrow: visible } = await openGig(app)
  const { creator } = await openGig(app)
  // a draft and an open-but-expired row must never surface
  const draft = await createEscrow(app, { creator_id: creator.row.id })
  await attachGigDetails(app, draft.id, { title: 'Draft gig' })
  const stale = await createEscrow(app, {
    creator_id: creator.row.id,
    status: 'open',
    accept_deadline: new Date(Date.now() - 60_000),
  })
  await attachGigDetails(app, stale.id, { title: 'Stale gig' })

  const res = await app.inject({ method: 'GET', url: '/v1/gigs' })
  assert.strictEqual(res.statusCode, 200)
  const body = res.json()
  assert.strictEqual(body.total, 2)
  const ids = body.data.map((g: { escrow_id: string }) => g.escrow_id)
  assert.ok(ids.includes(visible.id))
  assert.ok(!ids.includes(draft.id))
  assert.ok(!ids.includes(stale.id))
})

test('GET /v1/gigs: category filter + invalid category 400', { skip }, async () => {
  const app = getApp()
  await openGig(app, { category: 'service' })
  await openGig(app, { category: 'delivery' })
  const filtered = await app.inject({ method: 'GET', url: '/v1/gigs?category=delivery' })
  assert.strictEqual(filtered.json().total, 1)
  const invalid = await app.inject({ method: 'GET', url: '/v1/gigs?category=plumbing' })
  assert.strictEqual(invalid.statusCode, 400)
})

test('GET /v1/gigs: amount-range filters validate and apply', { skip }, async () => {
  const app = getApp()
  await openGig(app, { amount_raw: '1000000' })
  await openGig(app, { amount_raw: '9000000' })
  const ranged = await app.inject({ method: 'GET', url: '/v1/gigs?min_amount_raw=5000000' })
  assert.strictEqual(ranged.json().total, 1)
  const malformed = await app.inject({ method: 'GET', url: '/v1/gigs?min_amount_raw=1.5' })
  assert.strictEqual(malformed.statusCode, 400)
  const inverted = await app.inject({
    method: 'GET',
    url: '/v1/gigs?min_amount_raw=9&max_amount_raw=1',
  })
  assert.strictEqual(inverted.statusCode, 400)
})

test('GET /v1/gigs: full-text q matches the title', { skip }, async () => {
  const app = getApp()
  await openGig(app, { title: 'Paint my fence green' })
  await openGig(app, { title: 'Deliver a parcel downtown' })
  const res = await app.inject({ method: 'GET', url: '/v1/gigs?q=fence' })
  assert.strictEqual(res.statusCode, 200)
  assert.strictEqual(res.json().total, 1)
  assert.strictEqual(res.json().data[0].title, 'Paint my fence green')
})

// ---------- mine= -----------------------------------------------------------------

test('GET /v1/gigs?mine: 401 unauthenticated, 400 on a bad value', { skip }, async () => {
  const app = getApp()
  const anon = await app.inject({ method: 'GET', url: '/v1/gigs?mine=created' })
  assert.strictEqual(anon.statusCode, 401)
  const u = await createUser(app)
  const bad = await app.inject({
    method: 'GET',
    url: '/v1/gigs?mine=everything',
    headers: authHeader(u.token),
  })
  assert.strictEqual(bad.statusCode, 400)
})

test('GET /v1/gigs?mine=created: includes own drafts; excludes others', { skip }, async () => {
  const app = getApp()
  const me = await createUser(app)
  const other = await createUser(app)
  const draft = await createEscrow(app, { creator_id: me.row.id })
  await attachGigDetails(app, draft.id, { title: 'My draft' })
  const foreign = await createEscrow(app, { creator_id: other.row.id, status: 'open' })
  await attachGigDetails(app, foreign.id, { title: 'Foreign gig' })

  const res = await app.inject({
    method: 'GET',
    url: '/v1/gigs?mine=created',
    headers: authHeader(me.token),
  })
  assert.strictEqual(res.statusCode, 200)
  assert.strictEqual(res.json().total, 1)
  assert.strictEqual(res.json().data[0].escrow_id, draft.id)
})

test('GET /v1/gigs?mine: suspended accounts are rejected', { skip }, async () => {
  const app = getApp()
  const u = await createUser(app, { status: 'suspended' })
  const res = await app.inject({
    method: 'GET',
    url: '/v1/gigs?mine=created',
    headers: authHeader(u.token),
  })
  assert.strictEqual(res.statusCode, 403)
})

test('GET /v1/gigs?mine=working: rows where I am (assigned) counterparty', { skip }, async () => {
  const app = getApp()
  const me = await createUser(app)
  const poster = await createUser(app)
  const active = await createEscrow(app, {
    creator_id: poster.row.id,
    counterparty_id: me.row.id,
    status: 'accepted',
  })
  await attachGigDetails(app, active.id, { title: 'Working on this' })
  const assigned = await createEscrow(app, {
    creator_id: poster.row.id,
    assigned_counterparty_id: me.row.id,
    status: 'open',
  })
  await attachGigDetails(app, assigned.id, { title: 'Assigned to me' })

  const res = await app.inject({
    method: 'GET',
    url: '/v1/gigs?mine=working',
    headers: authHeader(me.token),
  })
  assert.strictEqual(res.statusCode, 200)
  assert.strictEqual(res.json().total, 2)
})

// ---------- device-token pruning (workers/processors.removeTokens) -----------------

test('removeTokens: prunes provider-dead tokens, leaves the rest', { skip }, async () => {
  const app = getApp()
  const u = await createUser(app)
  for (const token of ['tok-dead', 'tok-alive']) {
    const res = await app.inject({
      method: 'POST',
      url: '/v1/notifications/device-token',
      headers: authHeader(u.token),
      payload: { token, platform: 'fcm' },
    })
    assert.strictEqual(res.statusCode, 200)
  }

  await removeTokens(app, []) // no-op must not throw
  await removeTokens(app, ['tok-dead', 'tok-never-registered'])

  const left = await app.db
    .select({ token: device_tokens.token })
    .from(device_tokens)
    .where(eq(device_tokens.user_id, u.row.id))
  assert.deepStrictEqual(
    left.map((r) => r.token),
    ['tok-alive'],
  )
})
