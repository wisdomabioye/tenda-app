/**
 * GET /v1/exchange and GET /v1/exchange/:id are AUTHENTICATED reads.
 *
 * That is a decision, not drift (#112, verified 2026-09-08): decision #14
 * opens browsing and accepting to every SIGNED-IN user, and the route keeps
 * the book off anonymous scrapers — the shared exchange.contract header, the
 * route docblock and the web `(app)` shell all say the same thing. It only
 * looked like drift next to /v1/gigs, whose public feed answers 200 with no
 * token. Nothing pinned the 401, so the gate could have been removed with
 * every exchange test still green. This file is that pin.
 *
 * Both directions, because a 401 on its own is what a broken route answers
 * too: the same book that refuses the anonymous caller must serve the signed-in
 * one, advanced mode or not.
 */
import { test } from 'node:test'
import assert from 'node:assert'
import { ErrorCode } from '@tenda/shared'
import {
  TEST_DB_CONFIGURED,
  useTestApp,
  createUser,
  createEscrow,
  attachExchangeDetails,
  authHeader,
  type TestUser,
} from '../helpers/test-app'

const skip = !TEST_DB_CONFIGURED
const getApp = useTestApp()

/** One live sell offer, so a 200 below is a book with a row in it, not an empty one. */
async function liveOffer(app: ReturnType<typeof getApp>, seller: TestUser) {
  const escrow = await createEscrow(app, {
    creator_id: seller.row.id,
    kind: 'exchange',
    status: 'open',
  })
  await attachExchangeDetails(app, escrow.id)
  return escrow
}

test('GET /v1/exchange: no token is 401, and no offer leaks with it', { skip }, async () => {
  const app = getApp()
  await liveOffer(app, await createUser(app))

  const anon = await app.inject({ method: 'GET', url: '/v1/exchange' })
  assert.strictEqual(anon.statusCode, 401)
  const body = anon.json()
  assert.strictEqual(body.code, ErrorCode.UNAUTHORIZED)
  assert.strictEqual('data' in body, false, 'a refused read must not carry the book')
})

test('GET /v1/exchange: a signed-in user without advanced mode sees the book', { skip }, async () => {
  const app = getApp()
  const seller = await createUser(app)
  const offer = await liveOffer(app, seller)
  const browser = await createUser(app)
  assert.strictEqual(browser.row.advanced_mode_enabled, false, 'the fixture must be an ordinary user')

  const res = await app.inject({ method: 'GET', url: '/v1/exchange', headers: authHeader(browser.token) })
  assert.strictEqual(res.statusCode, 200)
  const ids = res.json().data.map((r: { escrow_id: string }) => r.escrow_id)
  assert.ok(ids.includes(offer.id), 'decision #14: browsing is open to every signed-in user')
})

test('GET /v1/exchange/:id: the detail read is gated the same way as the book', { skip }, async () => {
  const app = getApp()
  const offer = await liveOffer(app, await createUser(app))

  const anon = await app.inject({ method: 'GET', url: `/v1/exchange/${offer.id}` })
  assert.strictEqual(anon.statusCode, 401)
  assert.strictEqual(anon.json().code, ErrorCode.UNAUTHORIZED)

  const viewer = await createUser(app)
  const res = await app.inject({ method: 'GET', url: `/v1/exchange/${offer.id}`, headers: authHeader(viewer.token) })
  assert.strictEqual(res.statusCode, 200)
})
