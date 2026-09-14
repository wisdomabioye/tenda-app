/**
 * What a DEMO bearer may reach (#177).
 *
 * The demo session hands a token to anyone who asks — no body, no proof, no
 * account. Until the scope claim that token was an ORDINARY one, and MEASURED on
 * production 2026-09-14 it read `GET /v1/exchange`: three live offers, each
 * pairing a real person's name, avatar and country with the money they were
 * moving, to a caller who had proved nothing.
 *
 * These cases pin the two halves that make the fix worth having:
 *   - the demo still does everything the document offers it (the 402, and the
 *     draft read-back that follows), so scoping costs the feature nothing;
 *   - the refusal discriminates by SCOPE, not by agent-ness — a REAL agent from
 *     /v1/agent/register is unrestricted. Without that case a blanket "agents
 *     cannot read" bug would pass this file.
 *
 * `../helpers/agent-demo-env` first, for its side effect: config memoises on
 * first read, so the demo address must be set before the harness builds an app.
 */
import { DEMO_ADDRESS } from '../helpers/agent-demo-env'
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  DEMO_TOKEN_EXPIRES_IN,
  ErrorCode,
  apiRoutes,
  type AgentRegisterResponse,
  type AgentTaskPaymentRequired,
} from '@tenda/shared'
import { DEMO_SCOPE } from '@server/lib/auth/scope'
import {
  TEST_DB_CONFIGURED,
  attachExchangeDetails,
  authHeader,
  createEscrow,
  createUser,
  seedAltChain,
  useTestApp,
  type TestUser,
} from '../helpers/test-app'
import { agentTaskBody, registerAgent } from '../helpers/agent'

const skip = !TEST_DB_CONFIGURED
const getApp = useTestApp()

/** The documented call: POST with no body at all. */
async function demoToken(): Promise<string> {
  const res = await getApp().inject({ method: 'POST', url: apiRoutes.agent.demoSession })
  assert.strictEqual(res.statusCode, 200, res.body)
  return res.json<AgentRegisterResponse>().token
}

/** One live sell offer, so a 200 on the book means real rows, not an empty list. */
async function liveOffer(seller: TestUser): Promise<void> {
  const escrow = await createEscrow(getApp(), {
    creator_id: seller.row.id,
    kind: 'exchange',
    status: 'open',
  })
  await attachExchangeDetails(getApp(), escrow.id)
}

test('the demo bearer is REFUSED the exchange book, and told where to get a real session', { skip }, async () => {
  const app = getApp()
  await liveOffer(await createUser(app))
  const res = await app.inject({ method: 'GET', url: apiRoutes.exchange.list, headers: authHeader(await demoToken()) })

  assert.strictEqual(res.statusCode, 403, res.body)
  const body = res.json<{ code: string; message: string }>()
  assert.strictEqual(body.code, ErrorCode.FORBIDDEN)
  // A dead end is what round one scored badly. The refusal has to say the way on.
  assert.match(body.message, new RegExp(apiRoutes.agent.register))
  // And no offer may ride out on the refusal.
  assert.ok(!res.body.includes('fiat_currency'), 'an offer field leaked through the refusal')
})

test('an ordinary user is unaffected — the check discriminates by SCOPE, not by who is asking', { skip }, async () => {
  const app = getApp()
  const seller = await createUser(app)
  await liveOffer(seller)
  const human = await createUser(app)
  const res = await app.inject({ method: 'GET', url: apiRoutes.exchange.list, headers: authHeader(human.token) })
  assert.strictEqual(res.statusCode, 200, res.body)
  assert.ok(res.json<{ data: unknown[] }>().data.length > 0, 'the book must still serve a signed-in reader')
})

test('a REAL agent from /v1/agent/register is unrestricted', { skip }, async () => {
  const app = getApp()
  await liveOffer(await createUser(app))
  const agent = await registerAgent(app)
  const res = await app.inject({ method: 'GET', url: apiRoutes.exchange.list, headers: authHeader(agent.token) })
  // The case a blanket "agents cannot read" bug would fail.
  assert.strictEqual(res.statusCode, 200, res.body)
})

test('the demo bearer still REACHES THE 402 — the step every round-one reviewer missed', { skip }, async () => {
  const app = getApp()
  await seedAltChain(app)
  const token = await demoToken()
  const res = await app.inject({
    method: 'POST',
    url: apiRoutes.agent.tasks,
    headers: authHeader(token),
    payload: agentTaskBody(),
  })
  assert.strictEqual(res.statusCode, 402, res.body)
  const quote = res.json<AgentTaskPaymentRequired>()
  assert.strictEqual(quote.accepts[0].payment.creator.toLowerCase(), DEMO_ADDRESS.toLowerCase())
})

test('the demo bearer still reads its OWN draft back — the documented poll after the 402', { skip }, async () => {
  const app = getApp()
  await seedAltChain(app)
  const token = await demoToken()
  const quoted = await app.inject({
    method: 'POST',
    url: apiRoutes.agent.tasks,
    headers: authHeader(token),
    payload: agentTaskBody(),
  })
  assert.strictEqual(quoted.statusCode, 402, quoted.body)
  const { escrow_id } = quoted.json<AgentTaskPaymentRequired>().accepts[0]

  // This works because `gigs.get` is ALLOW-LISTED, not because the scope is
  // bypassed. The route's preHandler is `identifyViewer`, but its DRAFT branch
  // calls `fastify.authenticate` mid-handler (routes/v1/gigs/_id/index.ts) so
  // suspended accounts are rejected there too — and an agent's quoted task is
  // always a draft. Omitting it from the list refused this poll, which is how
  // the entry was found.
  // Derived from the route CONSTANT, like every other url in this suite — the
  // sibling agent tests never type a path, and `apiRoutes.gigs.get` is the same
  // value the allow-list matches on, so the two cannot drift apart.
  const detailUrl = apiRoutes.gigs.get.replace(':id', escrow_id)
  const draft = await app.inject({ method: 'GET', url: detailUrl, headers: authHeader(token) })
  assert.strictEqual(draft.statusCode, 200, draft.body)
  const anon = await app.inject({ method: 'GET', url: detailUrl })
  assert.strictEqual(anon.statusCode, 404, 'a draft must stay invisible to strangers')
})

/**
 * The one capability the scope takes away that a reviewer might reach for. It
 * is the `?mine=` branch, which calls `authenticate` INSIDE the handler — so
 * this also proves the check rides along there rather than only on preHandlers.
 */
test('the demo bearer cannot list its own drafts with ?mine=, and anonymous browsing is untouched', { skip }, async () => {
  const app = getApp()
  const token = await demoToken()
  const mine = await app.inject({ method: 'GET', url: `${apiRoutes.gigs.list}?mine=created`, headers: authHeader(token) })
  assert.strictEqual(mine.statusCode, 403, mine.body)
  assert.strictEqual(mine.json<{ code: string }>().code, ErrorCode.FORBIDDEN)

  // The public feed sends no token, so nothing about it changes.
  const open = await app.inject({ method: 'GET', url: apiRoutes.gigs.list })
  assert.strictEqual(open.statusCode, 200, open.body)
})

test('the demo token carries the scope claim and a SHORT life, not the 7-day default', { skip }, async () => {
  const app = getApp()
  const claims = app.jwt.decode<{ scope?: string; iat: number; exp: number }>(await demoToken())
  assert.ok(claims !== null)
  assert.strictEqual(claims.scope, DEMO_SCOPE)
  // Compared against a REAL ordinary session rather than a number typed here:
  // the invariant is "materially shorter than what everyone else gets", and a
  // literal would have to be edited in step with `JWT_EXPIRES_IN` by someone who
  // remembered this file existed.
  //
  // The comparison token comes from `/v1/agent/register`, NOT from `createUser`:
  // the fixture signs `{ id, role }` directly with no `expiresIn`, so its token
  // carries no `exp` at all and any comparison against it comes out NaN — which
  // is how the first version of this assertion compared against nothing. A
  // registration is a real unscoped session through the same `mintAuthResponse`,
  // so the two lifetimes are produced by one code path and differ only by scope.
  const ordinary = app.jwt.decode<{ scope?: string; iat: number; exp: number }>(
    (await registerAgent(app)).token,
  )
  assert.ok(ordinary !== null)
  const demoLife = claims.exp - claims.iat
  const ordinaryLife = ordinary.exp - ordinary.iat
  assert.ok(Number.isFinite(ordinaryLife), 'the ordinary token must carry an expiry to compare against')
  assert.ok(
    demoLife < ordinaryLife,
    `demo token lived ${demoLife}s against an ordinary ${ordinaryLife}s — ${DEMO_TOKEN_EXPIRES_IN} was intended`,
  )
  assert.strictEqual(ordinary.scope, undefined, 'an ordinary session must carry no scope claim')
})
