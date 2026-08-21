/**
 * Auth refusals that no test executed (#105 T4).
 *
 * Eight of the tranche's thirteen are reachable and are closed here; the other
 * five are defensive, unreachable-by-construction or race-only, and are recorded
 * at the end of this file rather than faked.
 *
 * Each case asserts the MESSAGE as well as the status. This surface answers
 * 400/401/422 from several places — often with near-identical wording — so the
 * status alone cannot say which guard fired, and the message is what a client
 * can act on.
 *
 * The two strategy cases are at the SEAM. `buildAuthStrategies` returns a map
 * keyed by method and the routes dispatch through it, so a strategy can never
 * receive a proof of the wrong kind by that route — but the strategies are
 * exported and a second caller would not have that guarantee. Testing them here
 * is testing them where they can actually be reached, which is the same
 * reasoning #99 used for `p2pFulfilment.open`.
 */
import { test } from 'node:test'
import assert from 'node:assert'
import { eq } from 'drizzle-orm'
import { users } from '@tenda/shared/db/schema'
import { buildAuthStrategies } from '@server/lib/auth/registry'
import type { AppError } from '@server/lib/errors'
import { TEST_DB_CONFIGURED, TEST_CHAIN_ID, useTestApp, createUser, authHeader } from '../helpers/test-app'

const skip = !TEST_DB_CONFIGURED
const getApp = useTestApp()

const ABSENT_USER = '00000000-0000-0000-0000-000000000000'

test('POST /v1/auth/challenge: a missing identifier is 422, naming the field', { skip }, async () => {
  // The method is checked first and was covered; the identifier check beside it
  // was not. Both refuse, so only the message says which.
  const app = getApp()

  for (const identifier of [undefined, '', 42, null]) {
    const res = await app.inject({
      method: 'POST', url: '/v1/auth/challenge', payload: { method: 'email', identifier },
    })
    assert.strictEqual(res.statusCode, 422, String(identifier))
    assert.match(res.json().message, /identifier is required/)
  }
})

test('POST /v1/auth/verify: an identifier the channel cannot normalise is 422', { skip }, async () => {
  // `normalizeIdentifier` is what turns a typed address or number into the
  // canonical form the OTP was issued against. When it cannot, the request must
  // stop — otherwise the lookup runs against a value that can never match, and
  // the caller sees "wrong code" for what is a malformed address.
  const app = getApp()

  for (const identifier of ['not-an-email', 'a@', '@b.com', 'plain text']) {
    const res = await app.inject({
      method: 'POST', url: '/v1/auth/verify',
      payload: { method: 'email', identifier, code: '123456' },
    })
    assert.strictEqual(res.statusCode, 422, identifier)
    assert.match(res.json().message, /invalid email identifier/)
  }
})

test('GET /v1/users/:id/standing: a well-formed id for nobody is 404', { skip }, async () => {
  // The param guard rejects a malformed uuid before the handler; this is the
  // other half — a syntactically valid id that belongs to no user. Public route,
  // so it is also the answer an unauthenticated prober gets.
  const app = getApp()

  const absent = await app.inject({ method: 'GET', url: `/v1/users/${ABSENT_USER}/standing` })
  assert.strictEqual(absent.statusCode, 404)
  assert.match(absent.json().message, /user not found/)

  // ...and a real user resolves, so the 404 is the lookup and not a broken route.
  const u = await createUser(app)
  const found = await app.inject({ method: 'GET', url: `/v1/users/${u.row.id}/standing` })
  assert.strictEqual(found.statusCode, 200)
})

// ---------- the deleted-user guards, reached through a WARM status cache ------

/**
 * These three read as unreachable and are not. `authenticate` loads the user
 * row and answers 401 'User no longer exists' when it is gone — which is why a
 * naive probe (create, delete, request) never reaches the handler and why my
 * first reading of this tranche recorded all three as shadowed.
 *
 * IT CACHES. `authenticate` keeps status/role for STATUS_CACHE_TTL_MS and skips
 * the DB read on a hit. So a user who has made ONE authenticated request and is
 * then deleted passes `authenticate` from cache for the rest of the minute, and
 * the handler's own lookup is the first thing to notice. That is not exotic: an
 * account deleted or hard-purged by an admin while its session is live hits it
 * on the very next request.
 *
 * MEASURED, both arms: cold cache → 401 'User no longer exists' (capital U, from
 * the preHandler); warm cache → the handler's own answer, which is 401 'user no
 * longer exists' on users/me and 404 'user not found' on auth/me. The case
 * distinction in the copy is the only thing telling the two apart, so every
 * assertion below pins the message exactly.
 */
async function deletedButCached(app: ReturnType<typeof getApp>): Promise<string> {
  const u = await createUser(app)
  // The warming request. Without it the preHandler answers and the guard under
  // test never runs — this line IS the test setup, not a sanity check.
  const warm = await app.inject({ method: 'GET', url: '/v1/users/me', headers: authHeader(u.token) })
  assert.strictEqual(warm.statusCode, 200, 'the warming request must succeed')
  await app.db.delete(users).where(eq(users.id, u.row.id))
  return u.token
}

test('GET /v1/users/me: a user deleted mid-session is 401 from the HANDLER', { skip }, async () => {
  const app = getApp()
  const token = await deletedButCached(app)

  const res = await app.inject({ method: 'GET', url: '/v1/users/me', headers: authHeader(token) })
  assert.strictEqual(res.statusCode, 401)
  // Lower case: the handler's copy, not the preHandler's 'User no longer exists'.
  assert.strictEqual(res.json().message, 'user no longer exists')
})

test('PATCH /v1/users/me: the update returns no row and is 401', { skip }, async () => {
  // A different guard from the one above — this one reads the result of an
  // UPDATE ... RETURNING rather than a SELECT, so a row deleted between the
  // preHandler and the write lands here. Without it the route would return
  // `{ user: undefined }` with a 200.
  const app = getApp()
  const token = await deletedButCached(app)

  const res = await app.inject({
    method: 'PATCH', url: '/v1/users/me', headers: authHeader(token),
    payload: { first_name: 'Ada' },
  })
  assert.strictEqual(res.statusCode, 401)
  assert.strictEqual(res.json().message, 'user no longer exists')
})

test('GET /v1/auth/me: a user deleted mid-session is 404, not 401', { skip }, async () => {
  // Deliberately different from its users/me twin, and worth pinning BECAUSE it
  // is inconsistent: the same condition answers 401 UNAUTHORIZED on one route
  // and 404 USER_NOT_FOUND on the other. A client that treats 401 as "re-login"
  // and 404 as "not found" behaves differently on two routes describing the
  // same event. Pinned as-is rather than silently harmonised — changing a status
  // is a wire change, and this tranche is about executing refusals, not
  // redesigning them.
  const app = getApp()
  const token = await deletedButCached(app)

  const res = await app.inject({ method: 'GET', url: '/v1/auth/me', headers: authHeader(token) })
  assert.strictEqual(res.statusCode, 404)
  assert.strictEqual(res.json().message, 'user not found')
  // The literal, not ErrorCode.USER_NOT_FOUND: this pins the WIRE value a client
  // branches on. Asserting the enum against itself could not fail.
  assert.strictEqual(res.json().code, 'USER_NOT_FOUND')

  // THE POSITIVE CONTROL, and it was missing until the coverage walk found it:
  // auth/me's success `return user` was executed by NO test in the suite, so a
  // route that 404ed for everyone satisfied the assertions above. Its users/me
  // twin is covered by other suites; this route had nothing.
  const live = await createUser(app)
  const ok = await app.inject({ method: 'GET', url: '/v1/auth/me', headers: authHeader(live.token) })
  assert.strictEqual(ok.statusCode, 200, ok.body)
  assert.strictEqual(ok.json().id, live.row.id)
})

// ---------- strategy seams ----------------------------------------------------

test('auth strategies: each refuses a proof of the wrong KIND', { skip }, async () => {
  // An internal invariant, and the reason it is worth pinning: the strategies
  // are a map keyed by method, and the only thing making the key agree with the
  // proof's discriminant is the route that looks one up and passes the other.
  // If those two ever disagree, the OTP strategy would read `identifier` off a
  // wallet proof and the wallet strategy would try to verify a signature that is
  // not there. These refuse instead, and nothing ran either.
  const app = getApp()
  // The registry type allows a method to be ABSENT — that is how an unconfigured
  // OAuth provider is represented. otp and wallet are unconditional, so this
  // narrows rather than casts, and it would fail loudly if that ever changed.
  const { email, wallet } = buildAuthStrategies(app)
  assert.ok(email !== undefined, 'the email strategy is unconditional')
  assert.ok(wallet !== undefined, 'the wallet strategy is unconditional')

  const is500 = (err: AppError): boolean => {
    assert.strictEqual(err.statusCode, 500)
    return true
  }

  await assert.rejects(
    email.verify({
      method: 'wallet',
      chain_id: TEST_CHAIN_ID,
      address: 'SolWallet1111111111111111111111111111111',
      message: 'msg',
      signature: 'sig',
    }),
    (err: AppError) => is500(err) && /otp strategy received a non-otp proof/.test(err.message),
  )

  await assert.rejects(
    wallet.verify({ method: 'email', identifier: 'a@b.com', code: '123456', user_id: null }),
    (err: AppError) => is500(err) && /wallet strategy received a non-wallet proof/.test(err.message),
  )
})

/**
 * NOT COVERED, and recorded rather than forced — the remaining five, which the
 * post-run lcov confirms are still the only unexecuted refusals in these files:
 *
 *   auth/verify:56  `parseProof`'s switch `default:`. The route validates with
 *                   `isAuthMethod` first and answers 400 'unknown auth method'
 *                   (measured), and `parseProof` is module-private, so nothing
 *                   can hand it an unvalidated method. Its real job is
 *                   EXHAUSTIVENESS: it fires the day `AuthMethod` gains a sixth
 *                   member and the switch is not extended. Unreachable today by
 *                   construction; delete it and that safety net goes with it.
 *
 *   auth/link-wallet:90  the `inserted.length === 0` arm. NOT the guard that
 *                   answers a repeat link — line 71 does that, a case-insensitive
 *                   pre-check throwing 409 with the IDENTICAL message, and it was
 *                   already covered. Line 90 is the race loser: two requests that
 *                   both pass the pre-check before either insert, settled by the
 *                   (chain_ns, address) UNIQUE constraint. There is no gap between
 *                   the two predicates to exploit — case-insensitive is strictly
 *                   broader than the exact unique — so reaching it needs a real
 *                   interleaving, which a test can only make likely, not certain.
 *                   MEASURED: a test asserting the duplicate-link 409 SURVIVES
 *                   neutering line 90 entirely, because line 71 answers first.
 *                   That test was written for this tranche and then deleted; a
 *                   flaky race case would be worse than this note.
 *
 *   lib/auth/orchestrator.ts 214, 238, 246
 *                   'user insert returned no row', 'identity race winner not
 *                   found', 'resolved user row missing'. 500s guarding states
 *                   the database cannot produce for a caller: an INSERT ...
 *                   RETURNING that returns nothing, and a row that vanishes
 *                   between two statements. Reaching them means breaking the
 *                   database, not exercising the product.
 *
 * THREE MORE ALMOST JOINED THIS LIST. My first reading put users/me:61,
 * users/me:116 and auth/me:23 here, on the strength of a probe showing
 * `authenticate` answering first. The probe had a COLD status cache; warm, the
 * guards are reachable, and they are tested above. The lesson is that "an
 * earlier guard answers" is a claim about ORDER AND STATE, and a single probe
 * only samples one state of it.
 *
 * Which is also why the obvious generalisation from those three is NOT made
 * here. escrows/index:55 is the same-looking guard in escrow-refusals.test.ts
 * (T2), and it really is unreachable — but not for the reason that file gives.
 * MEASURED: a deleted user POSTing /v1/escrows gets 403 PROFILE_INCOMPLETE,
 * while a live one gets a different 403, so the deletion is what changes the
 * answer. `requireProfileComplete` is a second preHandler on that route with
 * its own `users` read and a `row === undefined ||` condition — it, not
 * `authenticate`, is the shadow. Correcting that note is #108, filed rather
 * than done here because the file belongs to T2's diff.
 */
