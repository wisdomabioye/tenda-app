/**
 * CO2 route matrix — escrow creation surface:
 *   POST /v1/escrows (chain-agnostic core: validation + draft insert)
 *   POST /v1/gigs    (details satellite: ownership/kind/status/moderation)
 *
 * Real app via fastify.inject; gated on TEST_DATABASE_URL (helpers/test-app).
 */
import { test } from 'node:test'
import assert from 'node:assert'
import { eq } from 'drizzle-orm'
import { escrows, gig_details, users } from '@tenda/shared/db/schema'
import {
  TEST_DB_CONFIGURED,
  FAKE_UNSIGNED,
  useTestApp,
  createUser,
  createEscrow,
  makeTransactable,
  authHeader,
} from '../helpers/test-app'
import { createEscrowBody, gigDetailsBody } from '../helpers/escrow-states'
import {
  MAX_COMPLETION_DURATION_SECONDS,
  MIN_COMPLETION_DURATION_SECONDS,
} from '@tenda/shared'

const skip = !TEST_DB_CONFIGURED
const getApp = useTestApp()

// ---------- POST /v1/escrows --------------------------------------------------

test('POST /v1/escrows: 401 without a token', { skip }, async () => {
  const app = getApp()
  const res = await app.inject({ method: 'POST', url: '/v1/escrows', payload: createEscrowBody() })
  assert.strictEqual(res.statusCode, 401)
})

test('POST /v1/escrows: 403 PROFILE_INCOMPLETE when first_name is empty', { skip }, async () => {
  const app = getApp()
  const u = await createUser(app, { first_name: '' })
  const res = await app.inject({
    method: 'POST',
    url: '/v1/escrows',
    headers: authHeader(u.token),
    payload: createEscrowBody(),
  })
  assert.strictEqual(res.statusCode, 403)
  assert.strictEqual(res.json().code, 'PROFILE_INCOMPLETE')
})

test('POST /v1/escrows: 422 on invalid kind', { skip }, async () => {
  const app = getApp()
  const u = await createUser(app)
  const res = await app.inject({
    method: 'POST',
    url: '/v1/escrows',
    headers: authHeader(u.token),
    payload: createEscrowBody({ kind: 'bounty' }),
  })
  assert.strictEqual(res.statusCode, 422)
  assert.strictEqual(res.json().code, 'VALIDATION_ERROR')
})

/**
 * The completion window is BOUNDED at the API, not just in the composer (#52).
 *
 * Before this, any positive integer was accepted: ~3.2 years produced a draft
 * row and a transaction to sign, and the refusal arrived from the chain — both
 * contracts cap the window at ESCROW_LIMITS.maxCompletionDurationSeconds (180
 * days) — AFTER the user had signed. The bound enforced is the tighter product
 * rail the pickers already offer, so client and API cannot disagree.
 *
 * Through the route, not just the validator, because the validator being right
 * is not the same claim as the endpoint refusing.
 */
test('POST /v1/escrows: accepts a window at EITHER boundary', { skip }, async () => {
  const app = getApp()
  const u = await createUser(app)
  await makeTransactable(app, u.row.id)
  for (const seconds of [MIN_COMPLETION_DURATION_SECONDS, MAX_COMPLETION_DURATION_SECONDS]) {
    const res = await app.inject({
      method: 'POST',
      url: '/v1/escrows',
      headers: authHeader(u.token),
      payload: createEscrowBody({ completion_duration_seconds: seconds }),
    })
    assert.strictEqual(res.statusCode, 201, `boundary ${seconds} should be inside the window`)
  }
})

test('POST /v1/escrows: 422 one second past either boundary', { skip }, async () => {
  const app = getApp()
  const u = await createUser(app)
  await makeTransactable(app, u.row.id)
  for (const seconds of [
    MIN_COMPLETION_DURATION_SECONDS - 1,
    MAX_COMPLETION_DURATION_SECONDS + 1,
  ]) {
    const res = await app.inject({
      method: 'POST',
      url: '/v1/escrows',
      headers: authHeader(u.token),
      payload: createEscrowBody({ completion_duration_seconds: seconds }),
    })
    assert.strictEqual(res.statusCode, 422, `${seconds} should be outside the window`)
    assert.strictEqual(res.json().code, 'VALIDATION_ERROR')
  }
})

test('POST /v1/escrows: 422 for a non-integer window, and for the chain-reverting one', { skip }, async () => {
  const app = getApp()
  const u = await createUser(app)
  await makeTransactable(app, u.row.id)
  // 100_000_000s ≈ 3.2 years — past the 180-day contract limit, which is the
  // case that used to reach the chain.
  for (const seconds of [7_200.5, 100_000_000]) {
    const res = await app.inject({
      method: 'POST',
      url: '/v1/escrows',
      headers: authHeader(u.token),
      payload: createEscrowBody({ completion_duration_seconds: seconds }),
    })
    assert.strictEqual(res.statusCode, 422, `${seconds} should be refused`)
    assert.strictEqual(res.json().code, 'VALIDATION_ERROR')
  }
})

test('POST /v1/escrows: 422 on a chain the registry does not carry', { skip }, async () => {
  const app = getApp()
  const u = await createUser(app)
  const res = await app.inject({
    method: 'POST',
    url: '/v1/escrows',
    headers: authHeader(u.token),
    payload: createEscrowBody({ chain_id: 'eip155:8453' }),
  })
  assert.strictEqual(res.statusCode, 422)
})

test('POST /v1/escrows: 422 when a gig rides a non-USDC asset', { skip }, async () => {
  const app = getApp()
  const u = await createUser(app)
  const res = await app.inject({
    method: 'POST',
    url: '/v1/escrows',
    headers: authHeader(u.token),
    payload: createEscrowBody({ asset: 'SOL_DEVNET' }),
  })
  assert.strictEqual(res.statusCode, 422)
  assert.strictEqual(res.json().code, 'ESCROW_INVALID_ASSET')
})

test('POST /v1/escrows: 400 when the client supplies an id', { skip }, async () => {
  const app = getApp()
  const u = await createUser(app)
  const res = await app.inject({
    method: 'POST',
    url: '/v1/escrows',
    headers: authHeader(u.token),
    payload: createEscrowBody({ id: 'f0e36d8a-0000-0000-0000-000000000000' }),
  })
  assert.strictEqual(res.statusCode, 400)
})

test('POST /v1/escrows: 201 inserts a draft and returns the unsigned tx', { skip }, async () => {
  const app = getApp()
  const u = await createUser(app)
  await makeTransactable(app, u.row.id) // wallet + verified contact (9D gate)
  const res = await app.inject({
    method: 'POST',
    url: '/v1/escrows',
    headers: authHeader(u.token),
    payload: createEscrowBody(),
  })
  assert.strictEqual(res.statusCode, 201)
  const body = res.json()
  assert.deepStrictEqual(body.unsigned, FAKE_UNSIGNED)
  const [row] = await app.db.select().from(escrows).where(eq(escrows.id, body.escrow_id))
  assert.strictEqual(row.status, 'draft')
  assert.strictEqual(row.creator_id, u.row.id)
  assert.strictEqual(row.escrow_ref, null)
})

// ---------- POST /v1/gigs -------------------------------------------------------

test('POST /v1/gigs: 404 for an unknown escrow', { skip }, async () => {
  const app = getApp()
  const u = await createUser(app)
  const res = await app.inject({
    method: 'POST',
    url: '/v1/gigs',
    headers: authHeader(u.token),
    payload: gigDetailsBody('f0e36d8a-0000-0000-0000-000000000000'),
  })
  assert.strictEqual(res.statusCode, 404)
})

test('POST /v1/gigs: 403 when the caller is not the creator', { skip }, async () => {
  const app = getApp()
  const creator = await createUser(app)
  const stranger = await createUser(app)
  const escrow = await createEscrow(app, { creator_id: creator.row.id })
  const res = await app.inject({
    method: 'POST',
    url: '/v1/gigs',
    headers: authHeader(stranger.token),
    payload: gigDetailsBody(escrow.id),
  })
  assert.strictEqual(res.statusCode, 403)
})

test('POST /v1/gigs: 409 on an exchange escrow', { skip }, async () => {
  const app = getApp()
  const u = await createUser(app)
  const escrow = await createEscrow(app, { creator_id: u.row.id, kind: 'exchange' })
  const res = await app.inject({
    method: 'POST',
    url: '/v1/gigs',
    headers: authHeader(u.token),
    payload: gigDetailsBody(escrow.id),
  })
  assert.strictEqual(res.statusCode, 409)
  assert.strictEqual(res.json().code, 'ESCROW_WRONG_STATUS')
})

test('POST /v1/gigs: 409 once the escrow has left draft', { skip }, async () => {
  const app = getApp()
  const u = await createUser(app)
  const escrow = await createEscrow(app, { creator_id: u.row.id, status: 'open' })
  const res = await app.inject({
    method: 'POST',
    url: '/v1/gigs',
    headers: authHeader(u.token),
    payload: gigDetailsBody(escrow.id),
  })
  assert.strictEqual(res.statusCode, 409)
})

test('POST /v1/gigs: 400 CONTENT_MODERATED on a critical keyword', { skip }, async () => {
  const app = getApp()
  const u = await createUser(app)
  const escrow = await createEscrow(app, { creator_id: u.row.id })
  const res = await app.inject({
    method: 'POST',
    url: '/v1/gigs',
    headers: authHeader(u.token),
    payload: gigDetailsBody(escrow.id, { title: 'Need a hitman for a job' }),
  })
  assert.strictEqual(res.statusCode, 400)
  assert.strictEqual(res.json().code, 'CONTENT_MODERATED')
})

test('POST /v1/gigs: 400 on an invalid category', { skip }, async () => {
  const app = getApp()
  const u = await createUser(app)
  const escrow = await createEscrow(app, { creator_id: u.row.id })
  const res = await app.inject({
    method: 'POST',
    url: '/v1/gigs',
    headers: authHeader(u.token),
    payload: gigDetailsBody(escrow.id, { category: 'gardening' }),
  })
  assert.strictEqual(res.statusCode, 400)
})

test('POST /v1/gigs: 201, and the draft upsert retries clean (no 409)', { skip }, async () => {
  const app = getApp()
  const u = await createUser(app)
  const escrow = await createEscrow(app, { creator_id: u.row.id })
  const payload = gigDetailsBody(escrow.id)
  const first = await app.inject({ method: 'POST', url: '/v1/gigs', headers: authHeader(u.token), payload })
  assert.strictEqual(first.statusCode, 201)
  const retry = await app.inject({
    method: 'POST',
    url: '/v1/gigs',
    headers: authHeader(u.token),
    payload: { ...payload, title: 'Wash my car thoroughly' },
  })
  assert.strictEqual(retry.statusCode, 201)
  const [row] = await app.db.select().from(gig_details).where(eq(gig_details.escrow_id, escrow.id))
  assert.strictEqual(row.title, 'Wash my car thoroughly')
})

test('POST /v1/escrows: a token whose user no longer exists is refused 401 (#105 T2)', { skip }, async () => {
  // A user deleted after their token was minted still presents a structurally
  // valid JWT, and the create handler reads `is_seeker` off the row to pick the
  // fee tier — so something must refuse before it builds an escrow for nobody.
  //
  // WHICH guard refuses is not what the sweep assumed. It listed
  // routes/v1/escrows/index.ts:55 ('user no longer exists') as unexecuted, and
  // it is — but it is also UNREACHABLE through this route: `authenticate`
  // already loads the row and answers 401 'User no longer exists' first. The two
  // messages differ only in capitalisation, which is why the handler's copy
  // reads as live code. It is defence-in-depth for a caller that reaches the
  // handler another way; this case pins the behaviour that actually happens.
  const app = getApp()
  const u = await createUser(app)
  await makeTransactable(app, u.row.id)
  await app.db.delete(users).where(eq(users.id, u.row.id))

  const res = await app.inject({
    method: 'POST', url: '/v1/escrows', headers: authHeader(u.token), payload: createEscrowBody(),
  })
  assert.strictEqual(res.statusCode, 401, res.body)
  assert.match(res.json().message, /[Uu]ser no longer exists/)
})

// NOT ADDED: the sweep listed routes/v1/escrows/index.ts:194 and :197 as
// unexecuted, and they are — but they are the RACE copies. The same two guards
// exist twice: at 136-141 on the sequential path (an existing escrow with that
// operation id is found up front) and again at 194-201 for the case where a
// concurrent identical request won the unique key BETWEEN our lookup and our
// insert. The sequential pair is already covered, which a test written for the
// reuse rule proved by surviving the removal of 197 — it was exercising 136.
// The race copies need two requests interleaved inside one insert, which this
// harness cannot stage deterministically, so they stay recorded rather than
// faked. Line 55 ('user no longer exists') is shadowed for the same family of
// reason — see the case above.

