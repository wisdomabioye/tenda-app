/**
 * #98 gap-fill — POST /v1/auth/wallet (the login route) chained with
 * POST /v1/auth/nonce. Exercises the full flow end-to-end against the real
 * app + DB: nonce issue → message build → sig verify → nonce consume →
 * find-or-create user → JWT. Covers every guard + the adversarial cases
 * (bad sig must NOT burn the nonce; replay; expiry; mismatch; suspended;
 * unregistered chain → 400 not 500).
 *
 * Gated on TEST_DATABASE_URL.
 */
import { test } from 'node:test'
import assert from 'node:assert'
import { randomBytes } from 'node:crypto'
import { eq } from 'drizzle-orm'
import { users, user_wallets } from '@tenda/shared/db/schema/identity'
import { walletFixture } from '../helpers/fixtures'
import {
  TEST_DB_CONFIGURED,
  TEST_CHAIN_ID,
  FAKE_BAD_SIGNATURE,
  useTestApp,
  createUser,
} from '../helpers/test-app'
import { AUTH_URI, issueNonce, buildAuthMessage as buildMessage } from '../helpers/auth-message'

const skip = !TEST_DB_CONFIGURED
const getApp = useTestApp()

const GOOD_SIG = 'sig:ok'

let addrSeq = 0
function freshAddress(): string {
  return `SolLoginWallet${(addrSeq += 1)}1111111111111111111111`
}

type App = ReturnType<typeof getApp>

function login(
  app: App,
  body: { chain_id?: string; address: string; message: string; signature?: string } & Record<string, unknown>,
) {
  return app.inject({
    method: 'POST',
    url: '/v1/auth/wallet',
    payload: { chain_id: TEST_CHAIN_ID, signature: GOOD_SIG, ...body },
  })
}

/** Full happy-path: issue → sign → login. */
async function loginFresh(app: App, address: string, over: Record<string, unknown> = {}) {
  const { nonce, issued_at } = await issueNonce(app)
  const message = buildMessage({ address, nonce, issued_at })
  return login(app, { address, message, ...over })
}

// ---------- happy paths --------------------------------------------------------

test('wallet login: a new wallet creates user + primary wallet and returns a JWT', { skip }, async () => {
  const app = getApp()
  const address = freshAddress()
  const res = await loginFresh(app, address)
  assert.strictEqual(res.statusCode, 200)

  const out = res.json()
  assert.ok(typeof out.token === 'string' && out.token.length > 0)
  assert.strictEqual(out.user.status, 'active')

  // The wallet row exists, is primary, and points at the returned user.
  const [w] = await app.db
    .select()
    .from(user_wallets)
    .where(eq(user_wallets.address, address))
  assert.strictEqual(w.user_id, out.user.id)
  assert.strictEqual(w.is_primary, true)
  assert.strictEqual(w.chain_ns, 'solana')

  // The JWT carries the user id + role.
  const decoded = app.jwt.verify<{ id: string; role: string }>(out.token)
  assert.strictEqual(decoded.id, out.user.id)
})

test('wallet login: an existing wallet resolves to the same user (no duplicate)', { skip }, async () => {
  const app = getApp()
  const u = await createUser(app, { first_name: 'Existing' })
  const address = freshAddress()
  await app.db.insert(user_wallets).values(walletFixture({ user_id: u.row.id, address }))

  const before = (await app.db.select().from(users)).length
  const res = await loginFresh(app, address)
  assert.strictEqual(res.statusCode, 200)
  assert.strictEqual(res.json().user.id, u.row.id)
  assert.strictEqual((await app.db.select().from(users)).length, before) // no new user
})

test('wallet login: two concurrent logins for the same new wallet resolve to ONE user', { skip }, async () => {
  const app = getApp()
  const address = freshAddress()

  // Each login needs its own single-use nonce; fire both in parallel so they
  // race on the user_wallets unique insert (the find-or-create loser path).
  const a = await issueNonce(app)
  const b = await issueNonce(app)
  const [r1, r2] = await Promise.all([
    login(app, { address, message: buildMessage({ address, nonce: a.nonce, issued_at: a.issued_at }) }),
    login(app, { address, message: buildMessage({ address, nonce: b.nonce, issued_at: b.issued_at }) }),
  ])

  assert.strictEqual(r1.statusCode, 200)
  assert.strictEqual(r2.statusCode, 200)
  // Both requests must converge on the same user — no duplicate, no orphan.
  assert.strictEqual(r1.json().user.id, r2.json().user.id)

  const wallets = await app.db.select().from(user_wallets).where(eq(user_wallets.address, address))
  assert.strictEqual(wallets.length, 1)
  const allUsers = await app.db.select().from(users)
  assert.strictEqual(allUsers.length, 1) // the orphan from the losing insert was rolled back
})

// ---------- input validation ---------------------------------------------------

test('wallet login: missing signature → 400 VALIDATION_ERROR', { skip }, async () => {
  const app = getApp()
  const { nonce, issued_at } = await issueNonce(app)
  const address = freshAddress()
  const res = await app.inject({
    method: 'POST',
    url: '/v1/auth/wallet',
    payload: { chain_id: TEST_CHAIN_ID, address, message: buildMessage({ address, nonce, issued_at }) },
  })
  assert.strictEqual(res.statusCode, 400)
  assert.strictEqual(res.json().code, 'VALIDATION_ERROR')
})

test('wallet login: malformed message (no Nonce line) → 400', { skip }, async () => {
  const app = getApp()
  const address = freshAddress()
  const message = `Tenda wants you to sign in with your wallet:\n${address}\n\nChain: ${TEST_CHAIN_ID}\nURI: ${AUTH_URI}\nIssued At: ${new Date().toISOString()}`
  const res = await login(app, { address, message })
  assert.strictEqual(res.statusCode, 400)
})

test('wallet login: chain / address mismatch between body and message → 400', { skip }, async () => {
  const app = getApp()
  const address = freshAddress()
  const { nonce, issued_at } = await issueNonce(app)

  // message Chain differs from body chain_id
  const chainMismatch = await login(app, {
    address,
    message: buildMessage({ address, chain_id: 'solana:mainnet', nonce, issued_at }),
  })
  assert.strictEqual(chainMismatch.statusCode, 400)

  // message address differs from body address
  const addrMismatch = await login(app, {
    address,
    message: buildMessage({ address: freshAddress(), nonce, issued_at }),
  })
  assert.strictEqual(addrMismatch.statusCode, 400)
})

test('wallet login: issued_at outside the ±60s window → 400', { skip }, async () => {
  const app = getApp()
  const address = freshAddress()
  const { nonce } = await issueNonce(app)
  const stale = new Date(Date.now() - 120_000).toISOString()
  const res = await login(app, { address, message: buildMessage({ address, nonce, issued_at: stale }) })
  assert.strictEqual(res.statusCode, 400)
})

test('wallet login: an unregistered (well-formed) chain_id → 400, not 500', { skip }, async () => {
  const app = getApp()
  const address = freshAddress()
  const { nonce, issued_at } = await issueNonce(app)
  // eip155:8453 is a valid CAIP-2 but not registered in the harness registry.
  const res = await login(app, {
    chain_id: 'eip155:8453',
    address,
    message: buildMessage({ address, chain_id: 'eip155:8453', nonce, issued_at }),
  })
  assert.strictEqual(res.statusCode, 400)
  assert.strictEqual(res.json().code, 'VALIDATION_ERROR')
})

// ---------- signature + nonce lifecycle (adversarial) --------------------------

test('wallet login: a bad signature → 401 and does NOT consume the nonce', { skip }, async () => {
  const app = getApp()
  const address = freshAddress()
  const { nonce, issued_at } = await issueNonce(app)
  const message = buildMessage({ address, nonce, issued_at })

  const bad = await login(app, { address, message, signature: FAKE_BAD_SIGNATURE })
  assert.strictEqual(bad.statusCode, 401)
  assert.strictEqual(bad.json().code, 'INVALID_SIGNATURE')

  // The same nonce must still work — sig-check runs BEFORE consume, so an
  // attacker can't burn an observed nonce with garbage signatures.
  const good = await login(app, { address, message, signature: GOOD_SIG })
  assert.strictEqual(good.statusCode, 200)
})

test('wallet login: replaying a consumed nonce → 409 AUTH_NONCE_REPLAY', { skip }, async () => {
  const app = getApp()
  const address = freshAddress()
  const { nonce, issued_at } = await issueNonce(app)
  const message = buildMessage({ address, nonce, issued_at })

  assert.strictEqual((await login(app, { address, message })).statusCode, 200)
  const replay = await login(app, { address, message })
  assert.strictEqual(replay.statusCode, 409)
  assert.strictEqual(replay.json().code, 'AUTH_NONCE_REPLAY')
})

test('wallet login: a never-issued nonce → 401 AUTH_NONCE_UNKNOWN', { skip }, async () => {
  const app = getApp()
  const address = freshAddress()
  const nonce = randomBytes(32).toString('base64url') // well-formed (43 chars), never inserted
  const message = buildMessage({ address, nonce, issued_at: new Date().toISOString() })
  const res = await login(app, { address, message })
  assert.strictEqual(res.statusCode, 401)
  assert.strictEqual(res.json().code, 'AUTH_NONCE_UNKNOWN')
})

// ---------- account state ------------------------------------------------------

test('wallet login: a suspended user → 403 USER_SUSPENDED', { skip }, async () => {
  const app = getApp()
  const u = await createUser(app, { status: 'suspended' })
  const address = freshAddress()
  await app.db.insert(user_wallets).values(walletFixture({ user_id: u.row.id, address }))

  const res = await loginFresh(app, address)
  assert.strictEqual(res.statusCode, 403)
  assert.strictEqual(res.json().code, 'USER_SUSPENDED')
})
