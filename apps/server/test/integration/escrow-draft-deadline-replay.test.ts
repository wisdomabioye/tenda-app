/**
 * A draft replay must survive the accept deadline the SERVER refreshed (#32).
 *
 * `prepareDraftCreate` rewrites `escrows.accept_deadline` when it is lapsed or
 * inside its 60s refresh margin, and persists it so the row can never disagree
 * with the transaction it just built. `matchesTerms` used to compare that
 * column against the instant the caller sent — so the caller was refused for a
 * change the server had made, and the identical body answered 409 "already
 * used with different escrow terms".
 *
 * Both entry points are exercised because both are stranded by it: the human
 * POST /v1/escrows retried after build-create, and the agent one-shot's
 * 402 → X-PAYMENT resend (which refreshes on its OWN first call, since the
 * quote goes through prepareDraftCreate too).
 *
 * The near deadlines here are 30 SECONDS out. That is not an exotic value —
 * it is any listing whose accept window has nearly run out by the time the
 * creator signs, and `validateCreateEscrow` accepts anything in the future.
 *
 * Real app via fastify.inject; gated on TEST_DATABASE_URL (helpers/test-app).
 */
import { test } from 'node:test'
import assert from 'node:assert'
import { randomUUID } from 'node:crypto'
import { eq } from 'drizzle-orm'
import type { FastifyInstance, LightMyRequestResponse } from 'fastify'
import { escrows } from '@tenda/shared/db/schema'
import { X_PAYMENT_HEADER, apiRoutes, type AgentTaskCreated, type AgentTaskPaymentRequired } from '@tenda/shared'
import {
  TEST_CHAIN_ID,
  TEST_DB_CONFIGURED,
  authHeader,
  createTransactableUser,
  seedAltChain,
  useTestApp,
  type TestUser,
} from '../helpers/test-app'
import { createEscrowBody } from '../helpers/escrow-states'
import { agentPaymentHeader, agentTaskBody, registerAgent } from '../helpers/agent'

const skip = !TEST_DB_CONFIGURED
const getApp = useTestApp()

/** Close enough that prepareDraftCreate's 60s margin refreshes it; still valid to send. */
const NEAR_SECONDS = 30

type CreateEscrowRequestBody = ReturnType<typeof createEscrowBody>

function post(
  app: FastifyInstance,
  user: TestUser,
  payload: CreateEscrowRequestBody,
): Promise<LightMyRequestResponse> {
  return app.inject({ method: 'POST', url: '/v1/escrows', headers: authHeader(user.token), payload })
}

function buildCreate(app: FastifyInstance, user: TestUser, id: string): Promise<LightMyRequestResponse> {
  return app.inject({
    method: 'POST',
    url: `/v1/escrows/${id}/build-create`,
    headers: authHeader(user.token),
  })
}

async function deadlineOf(app: FastifyInstance, id: string): Promise<number> {
  const [row] = await app.db
    .select({ accept_deadline: escrows.accept_deadline })
    .from(escrows)
    .where(eq(escrows.id, id))
  assert.ok(row?.accept_deadline, 'the draft carries a deadline')
  return row.accept_deadline.getTime()
}

/**
 * Record the `accept_deadline_unix` every createEscrow build encodes while
 * `body` runs. The harness's fake adapter is already this suite's one
 * substitution; restoring it in `finally` is load-bearing (it is shared).
 */
async function withCapturedDeadlines(
  app: FastifyInstance,
  body: () => Promise<void>,
): Promise<number[]> {
  const adapter = app.chains.get(TEST_CHAIN_ID)
  const original = adapter.buildTx
  const seen: number[] = []
  adapter.buildTx = async (build) => {
    if (build.action === 'createEscrow') seen.push(build.payload.accept_deadline_unix)
    return original(build)
  }
  try {
    await body()
  } finally {
    adapter.buildTx = original
  }
  return seen
}

test('create replay: the deadline the SERVER refreshed does not refuse the caller', { skip }, async () => {
  const app = getApp()
  const user = await createTransactableUser(app)
  const sent_unix = Math.floor(Date.now() / 1000) + NEAR_SECONDS
  const body = createEscrowBody({ creation_operation_id: randomUUID(), accept_deadline_unix: sent_unix })

  const first = await post(app, user, body)
  assert.strictEqual(first.statusCode, 201, first.body)
  const escrow_id: string = first.json().escrow_id
  // The create route does not refresh: the row still holds what was sent, so
  // the 200 below cannot be explained by the deadline never having moved.
  assert.strictEqual(await deadlineOf(app, escrow_id), sent_unix * 1000)

  // Publishing is what rewrites it — the same step the one-shot's quote runs.
  assert.strictEqual((await buildCreate(app, user, escrow_id)).statusCode, 200)
  const refreshed = await deadlineOf(app, escrow_id)
  assert.ok(refreshed > sent_unix * 1000, 'the server moved the deadline forward')

  // THE REGRESSION: the identical body, resent. 409 before the fix.
  const encoded = await withCapturedDeadlines(app, async () => {
    const replay = await post(app, user, body)
    assert.strictEqual(replay.statusCode, 200, replay.body)
    assert.strictEqual(replay.json().escrow_id, escrow_id, 'the same draft, not a second escrow')
    assert.ok(replay.json().unsigned, 'the caller still gets something to sign')
  })

  // And the rebuilt transaction encodes the ROW's deadline, not the resent
  // instant — the reason the resent one is not worth comparing.
  assert.deepStrictEqual(encoded, [Math.floor(refreshed / 1000)])
  assert.strictEqual(await deadlineOf(app, escrow_id), refreshed, 'the replay did not move it back')
})

test('create replay: a term the CALLER changed is still refused', { skip }, async () => {
  // The control for the test above: dropping the deadline from the comparison
  // must not have dropped the comparison. Same operation id, one real change.
  const app = getApp()
  const user = await createTransactableUser(app)
  const operation_id = randomUUID()
  const body = createEscrowBody({ creation_operation_id: operation_id, amount_raw: '1000000' })

  assert.strictEqual((await post(app, user, body)).statusCode, 201)

  for (const changed of [
    { amount_raw: '2000000' },
    { completion_duration_seconds: 7_200 },
    { dispute_bond_raw: '500' },
  ]) {
    const res = await post(app, user, { ...body, ...changed })
    assert.strictEqual(res.statusCode, 409, `${JSON.stringify(changed)} → ${res.body}`)
    assert.strictEqual(res.json().code, 'VALIDATION_ERROR')
    assert.strictEqual(
      res.json().message,
      'creation_operation_id was already used with different escrow terms',
    )
  }
})

test('create replay: a caller-changed deadline replays the first draft rather than refusing', { skip }, async () => {
  // The cost of the fix, stated rather than left to be discovered: the accept
  // deadline is no longer part of the operation key's terms, so reusing the id
  // with a different one is an idempotent replay. What the caller gets back is
  // the deadline that WON, and the row is not rewritten by the resend.
  const app = getApp()
  const user = await createTransactableUser(app)
  const operation_id = randomUUID()
  const first_unix = Math.floor(Date.now() / 1000) + 86_400
  const body = createEscrowBody({ creation_operation_id: operation_id, accept_deadline_unix: first_unix })

  const created = await post(app, user, body)
  assert.strictEqual(created.statusCode, 201, created.body)
  const escrow_id: string = created.json().escrow_id

  const encoded = await withCapturedDeadlines(app, async () => {
    const res = await post(app, user, { ...body, accept_deadline_unix: first_unix + 3_600 })
    assert.strictEqual(res.statusCode, 200, res.body)
    assert.strictEqual(res.json().escrow_id, escrow_id)
  })
  assert.deepStrictEqual(encoded, [first_unix], "the first draft's deadline, not the resent one")
  assert.strictEqual(await deadlineOf(app, escrow_id), first_unix * 1000)
})

test('one-shot: a near-now deadline survives the 402 → X-PAYMENT resend', { skip }, async () => {
  const app = getApp()
  await seedAltChain(app)
  const agent = await registerAgent(app)
  const sent_unix = Math.floor(Date.now() / 1000) + NEAR_SECONDS
  const body = agentTaskBody({ accept_deadline_unix: sent_unix })

  const quote = await app.inject({
    method: 'POST',
    url: apiRoutes.agent.tasks,
    headers: authHeader(agent.token),
    payload: body,
  })
  assert.strictEqual(quote.statusCode, 402, quote.body)
  const task_id = quote.json<AgentTaskPaymentRequired>().task_id
  // The quote goes through prepareDraftCreate, so the 402 itself refreshed it.
  const refreshed = await deadlineOf(app, task_id)
  assert.ok(refreshed > sent_unix * 1000, 'the quote moved the deadline forward')

  // THE REGRESSION: the same body resent with the payment. 409 before the fix,
  // which stranded the agent with a signed authorization and no way to spend it.
  const paid = await app.inject({
    method: 'POST',
    url: apiRoutes.agent.tasks,
    headers: { ...authHeader(agent.token), [X_PAYMENT_HEADER]: agentPaymentHeader(agent.address) },
    payload: body,
  })
  assert.strictEqual(paid.statusCode, 201, paid.body)
  const created = paid.json<AgentTaskCreated>()
  assert.strictEqual(created.task_id, task_id, 'the draft the 402 quoted, not a second one')
  assert.strictEqual(created.recorded, true)

  const drafts = await app.db.select({ id: escrows.id }).from(escrows)
  assert.strictEqual(drafts.length, 1, 'one draft across both calls')
})
