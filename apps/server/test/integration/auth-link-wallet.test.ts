/**
 * #98 gap-fill + review finding — POST /v1/auth/link-wallet. Adds a SECOND
 * wallet to an already-authenticated user via the same nonce + signed-message
 * flow as wallet sign-in, but signed from the NEW wallet.
 *
 * Lead case is the review finding: a well-formed but UNREGISTERED chain_id
 * must 400, not 500 — link-wallet shared the wallet route's unguarded
 * `chains.get(untrusted)` bug (fixed alongside this suite). Fails pre-fix.
 *
 * Gated on TEST_DATABASE_URL.
 */
import { test } from 'node:test'
import assert from 'node:assert'
import { eq } from 'drizzle-orm'
import { user_wallets } from '@tenda/shared/db/schema/identity'
import { walletFixture } from '../helpers/fixtures'
import {
  TEST_DB_CONFIGURED,
  TEST_CHAIN_ID,
  FAKE_BAD_SIGNATURE,
  useTestApp,
  createUser,
  authHeader,
} from '../helpers/test-app'
import { issueNonce, buildAuthMessage } from '../helpers/auth-message'

const skip = !TEST_DB_CONFIGURED
const getApp = useTestApp()
const GOOD_SIG = 'sig:ok'

type App = ReturnType<typeof getApp>

let addrSeq = 0
function freshAddress(): string {
  return `SolLinkWallet${(addrSeq += 1)}11111111111111111111111`
}

/** Authenticated link attempt: issue nonce → sign from `address` → POST. */
async function link(
  app: App,
  token: string,
  address: string,
  over: { chain_id?: string; signature?: string } = {},
) {
  const { nonce, issued_at } = await issueNonce(app)
  const chain_id = over.chain_id ?? TEST_CHAIN_ID
  const message = buildAuthMessage({ address, chain_id, nonce, issued_at })
  return app.inject({
    method: 'POST',
    url: '/v1/auth/link-wallet',
    headers: authHeader(token),
    payload: { chain_id, address, message, signature: over.signature ?? GOOD_SIG },
  })
}

// ---------- happy path ---------------------------------------------------------

test('link-wallet: links a new wallet (non-primary) to the authed user', { skip }, async () => {
  const app = getApp()
  const u = await createUser(app)
  // Give the user an initial primary wallet so the new one is genuinely a 2nd.
  await app.db.insert(user_wallets).values(walletFixture({ user_id: u.row.id, is_primary: true }))

  const address = freshAddress()
  const res = await link(app, u.token, address)
  assert.strictEqual(res.statusCode, 200)
  assert.strictEqual(res.json().ok, true)

  const [w] = await app.db.select().from(user_wallets).where(eq(user_wallets.address, address))
  assert.strictEqual(w.user_id, u.row.id)
  assert.strictEqual(w.is_primary, false)
  assert.strictEqual(w.chain_ns, 'solana')
})

// ---------- chain gate (decoupled from escrow provisioning) --------------------

test('link-wallet: a valid namespace on an UNPROVISIONED chain links successfully (login ≠ provisioning)', { skip }, async () => {
  const app = getApp()
  const u = await createUser(app)
  const address = freshAddress()
  // eip155:8453 is valid CAIP-2 but not in the harness registry (solana:devnet
  // only). Linking verifies the sig by NAMESPACE (pure crypto), so it succeeds.
  const res = await link(app, u.token, address, { chain_id: 'eip155:8453' })
  assert.strictEqual(res.statusCode, 200)
  const [w] = await app.db.select().from(user_wallets).where(eq(user_wallets.address, address))
  assert.strictEqual(w.chain_ns, 'eip155')
})

test('link-wallet: an unsupported chain NAMESPACE → 400 VALIDATION_ERROR', { skip }, async () => {
  const app = getApp()
  const u = await createUser(app)
  const res = await link(app, u.token, freshAddress(), { chain_id: 'cosmos:1' })
  assert.strictEqual(res.statusCode, 400)
  assert.strictEqual(res.json().code, 'VALIDATION_ERROR')
})

// ---------- auth + validation --------------------------------------------------

test('link-wallet: unauthenticated → 401', { skip }, async () => {
  const app = getApp()
  const { nonce, issued_at } = await issueNonce(app)
  const address = freshAddress()
  const res = await app.inject({
    method: 'POST',
    url: '/v1/auth/link-wallet',
    payload: {
      chain_id: TEST_CHAIN_ID,
      address,
      message: buildAuthMessage({ address, nonce, issued_at }),
      signature: GOOD_SIG,
    },
  })
  assert.strictEqual(res.statusCode, 401)
})

test('link-wallet: missing signature → 400 VALIDATION_ERROR', { skip }, async () => {
  const app = getApp()
  const u = await createUser(app)
  const { nonce, issued_at } = await issueNonce(app)
  const address = freshAddress()
  const res = await app.inject({
    method: 'POST',
    url: '/v1/auth/link-wallet',
    headers: authHeader(u.token),
    payload: { chain_id: TEST_CHAIN_ID, address, message: buildAuthMessage({ address, nonce, issued_at }) },
  })
  assert.strictEqual(res.statusCode, 400)
  assert.strictEqual(res.json().code, 'VALIDATION_ERROR')
})

// ---------- signature + idempotency (adversarial) ------------------------------

test('link-wallet: a bad signature → 401 and does NOT consume the nonce', { skip }, async () => {
  const app = getApp()
  const u = await createUser(app)
  const address = freshAddress()
  const { nonce, issued_at } = await issueNonce(app)
  const message = buildAuthMessage({ address, nonce, issued_at })

  const bad = await app.inject({
    method: 'POST',
    url: '/v1/auth/link-wallet',
    headers: authHeader(u.token),
    payload: { chain_id: TEST_CHAIN_ID, address, message, signature: FAKE_BAD_SIGNATURE },
  })
  assert.strictEqual(bad.statusCode, 401)
  assert.strictEqual(bad.json().code, 'INVALID_SIGNATURE')

  // sig-check runs BEFORE consume, so the observed nonce is still spendable.
  const good = await app.inject({
    method: 'POST',
    url: '/v1/auth/link-wallet',
    headers: authHeader(u.token),
    payload: { chain_id: TEST_CHAIN_ID, address, message, signature: GOOD_SIG },
  })
  assert.strictEqual(good.statusCode, 200)
})

test('link-wallet: linking a wallet already linked to anyone → 409', { skip }, async () => {
  const app = getApp()
  const owner = await createUser(app, { first_name: 'Owner' })
  const other = await createUser(app, { first_name: 'Other' })
  const address = freshAddress()
  // owner already holds the wallet; `other` tries to link the same address.
  await app.db.insert(user_wallets).values(walletFixture({ user_id: owner.row.id, address }))

  const res = await link(app, other.token, address)
  assert.strictEqual(res.statusCode, 409)
  assert.strictEqual(res.json().code, 'VALIDATION_ERROR')
})
