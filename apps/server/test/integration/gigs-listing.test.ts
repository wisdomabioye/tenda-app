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
import { POSTED_ESCROW_STATUSES } from '@tenda/shared'
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

// ---------- status filter on own listings (MB2) --------------------------------

test('GET /v1/gigs?mine= : status filter buckets own listings, and total is the count', { skip }, async () => {
  const app = getApp()
  const owner = await createUser(app)
  const statuses = ['open', 'accepted', 'submitted', 'completed', 'completed'] as const
  for (const status of statuses) {
    const escrow = await createEscrow(app, { creator_id: owner.row.id, status })
    await attachGigDetails(app, escrow.id, { title: `${status} gig` })
  }

  // limit=1 makes this a COUNT read: one row back, `total` carries the answer.
  const active = await app.inject({
    method: 'GET',
    url: '/v1/gigs?mine=created&status=open,accepted,submitted&limit=1',
    headers: authHeader(owner.token),
  })
  assert.strictEqual(active.statusCode, 200)
  assert.strictEqual(active.json().total, 3, 'total counts every match, not just the page')
  assert.strictEqual(active.json().data.length, 1, 'the page itself stays limited')

  const completed = await app.inject({
    method: 'GET',
    url: '/v1/gigs?mine=created&status=completed&limit=1',
    headers: authHeader(owner.token),
  })
  assert.strictEqual(completed.json().total, 2)
})

test('GET /v1/gigs?mine=created : the posted bucket and the draft bucket partition the owner rows', { skip }, async () => {
  // The split the My Gigs screen is built on: "Posted" must not count drafts
  // (an unfunded staging row is not a posted gig), while "Drafts" is the only
  // surface that lists them — so neither bucket may drop or double-count a row.
  const app = getApp()
  const owner = await createUser(app)
  const statuses = ['draft', 'draft', 'open', 'accepted', 'completed', 'cancelled'] as const
  for (const status of statuses) {
    const escrow = await createEscrow(app, { creator_id: owner.row.id, status })
    await attachGigDetails(app, escrow.id, { title: `${status} gig` })
  }

  const countOf = async (query: string) => {
    const res = await app.inject({
      method: 'GET',
      url: `/v1/gigs?mine=created&limit=50${query}`,
      headers: authHeader(owner.token),
    })
    assert.strictEqual(res.statusCode, 200)
    return res.json() as { total: number; data: { status: string }[] }
  }

  const posted = await countOf(`&status=${POSTED_ESCROW_STATUSES.join(',')}`)
  assert.strictEqual(posted.total, 4, 'four on-chain rows, the two drafts excluded')
  assert.ok(
    posted.data.every((g) => g.status !== 'draft'),
    'no draft may appear in the posted bucket',
  )

  const drafts = await countOf('&status=draft')
  assert.strictEqual(drafts.total, 2)
  assert.ok(drafts.data.every((g) => g.status === 'draft'))

  // Unfiltered `mine=created` still returns everything — the buckets partition
  // it rather than hiding rows from the owner.
  const all = await countOf('')
  assert.strictEqual(all.total, statuses.length)
  assert.strictEqual(posted.total + drafts.total, all.total)
})

test('GET /v1/gigs?mine=working : status filter applies to the worker side', { skip }, async () => {
  const app = getApp()
  const owner = await createUser(app)
  const worker = await createUser(app)
  for (const status of ['completed', 'completed', 'accepted'] as const) {
    const escrow = await createEscrow(app, {
      creator_id: owner.row.id,
      counterparty_id: worker.row.id,
      status,
    })
    await attachGigDetails(app, escrow.id, { title: `${status} gig` })
  }

  const res = await app.inject({
    method: 'GET',
    url: '/v1/gigs?mine=working&status=completed&limit=1',
    headers: authHeader(worker.token),
  })
  assert.strictEqual(res.json().total, 2)
})

test('GET /v1/gigs: status on the PUBLIC feed is rejected, not silently emptied', { skip }, async () => {
  const app = getApp()
  await openGig(app)
  // Silently ANDing with status='open' would return an empty page and read as
  // "no such gigs" — for a filter that is really a probe for non-public rows.
  const res = await app.inject({ method: 'GET', url: '/v1/gigs?status=draft' })
  assert.strictEqual(res.statusCode, 400)
  assert.match(res.json().message, /status filter requires mine=/)
})

test('GET /v1/gigs?mine= : an unknown status is a 400, not a 500 from the enum', { skip }, async () => {
  const app = getApp()
  const owner = await createUser(app)
  const res = await app.inject({
    method: 'GET',
    url: '/v1/gigs?mine=created&status=open,banana',
    headers: authHeader(owner.token),
  })
  assert.strictEqual(res.statusCode, 400)
  assert.match(res.json().message, /status must be one of/)
})

test('GET /v1/gigs?mine= : an empty status param means no filter', { skip }, async () => {
  const app = getApp()
  const owner = await createUser(app)
  const draft = await createEscrow(app, { creator_id: owner.row.id })
  await attachGigDetails(app, draft.id, { title: 'Draft gig' })

  const res = await app.inject({
    method: 'GET',
    url: '/v1/gigs?mine=created&status=',
    headers: authHeader(owner.token),
  })
  assert.strictEqual(res.statusCode, 200)
  assert.strictEqual(res.json().total, 1, 'drafts still included — no filter applied')
})

test('GET /v1/gigs?mine= : status cannot reach another user rows', { skip }, async () => {
  const app = getApp()
  const owner = await createUser(app)
  const stranger = await createUser(app)
  const escrow = await createEscrow(app, { creator_id: owner.row.id, status: 'completed' })
  await attachGigDetails(app, escrow.id, { title: 'Owner gig' })

  const res = await app.inject({
    method: 'GET',
    url: '/v1/gigs?mine=created&status=completed&limit=1',
    headers: authHeader(stranger.token),
  })
  assert.strictEqual(res.json().total, 0, 'identity comes from the JWT, not the filter')
})
