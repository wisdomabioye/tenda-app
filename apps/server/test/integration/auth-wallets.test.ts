/**
 * #98 gap-fill — wallet-management auth routes:
 *   POST /v1/auth/unlink-wallet      (3 guards + active-escrow block)
 *   POST /v1/auth/set-primary-wallet (atomic primary swap)
 *
 * Real app via fastify.inject; gated on TEST_DATABASE_URL.
 */
import { test } from 'node:test'
import assert from 'node:assert'
import { eq } from 'drizzle-orm'
import { user_wallets, user_identities } from '@tenda/shared/db/schema/identity'
import { walletFixture } from '../helpers/fixtures'
import {
  TEST_DB_CONFIGURED, useTestApp, createUser, createEscrow, authHeader,
} from '../helpers/test-app'

const skip = !TEST_DB_CONFIGURED
const getApp = useTestApp()

let addrSeq = 0
async function link(app: ReturnType<typeof getApp>, user_id: string, over: Partial<ReturnType<typeof walletFixture>> = {}) {
  const w = walletFixture({ user_id, address: `SolWallet${addrSeq++}1111111111111111111111111`, ...over })
  await app.db.insert(user_wallets).values(w)
  return w
}

// ---------- unlink-wallet --------------------------------------------------------

test('unlink-wallet: 422 on an invalid chain_ns', { skip }, async () => {
  const app = getApp()
  const u = await createUser(app)
  const res = await app.inject({
    method: 'POST', url: '/v1/auth/unlink-wallet', headers: authHeader(u.token),
    payload: { chain_ns: 'bitcoin', address: 'x' },
  })
  assert.strictEqual(res.statusCode, 422)
})

test('unlink-wallet: 422 when address is missing', { skip }, async () => {
  const app = getApp()
  const u = await createUser(app)
  const res = await app.inject({
    method: 'POST', url: '/v1/auth/unlink-wallet', headers: authHeader(u.token),
    payload: { chain_ns: 'solana' },
  })
  assert.strictEqual(res.statusCode, 422)
})

test('unlink-wallet: 404 when the wallet is not linked', { skip }, async () => {
  const app = getApp()
  const u = await createUser(app)
  await link(app, u.row.id) // some other wallet so it is not the "only wallet" path
  const res = await app.inject({
    method: 'POST', url: '/v1/auth/unlink-wallet', headers: authHeader(u.token),
    payload: { chain_ns: 'solana', address: 'NotLinkedAddr1111111111111111111111111111' },
  })
  assert.strictEqual(res.statusCode, 404)
})

test('unlink-wallet: 409 LAST_CREDENTIAL when the wallet is the only sign-in method', { skip }, async () => {
  const app = getApp()
  const u = await createUser(app) // no identities → the wallet is the sole credential
  const w = await link(app, u.row.id, { is_primary: true })
  const res = await app.inject({
    method: 'POST', url: '/v1/auth/unlink-wallet', headers: authHeader(u.token),
    payload: { chain_ns: w.chain_ns, address: w.address },
  })
  assert.strictEqual(res.statusCode, 409)
  assert.strictEqual(res.json().code, 'LAST_CREDENTIAL')
})

test('unlink-wallet: 200 unlinks the sole wallet when a verified contact remains', { skip }, async () => {
  const app = getApp()
  const u = await createUser(app)
  const w = await link(app, u.row.id, { is_primary: true })
  // A verified email keeps the account reachable + sign-in-able, so dropping
  // the only wallet is allowed (credential model — wallet re-links at next tx).
  await app.db.insert(user_identities).values({
    user_id: u.row.id, kind: 'email', identifier: `keep-${u.row.id}@x.io`,
    email: `keep-${u.row.id}@x.io`, verified_at: new Date(),
  })
  const res = await app.inject({
    method: 'POST', url: '/v1/auth/unlink-wallet', headers: authHeader(u.token),
    payload: { chain_ns: w.chain_ns, address: w.address },
  })
  assert.strictEqual(res.statusCode, 200)
  assert.strictEqual(res.json().unlinked, true)
  const left = await app.db.select().from(user_wallets).where(eq(user_wallets.user_id, u.row.id))
  assert.strictEqual(left.length, 0)
})

test('unlink-wallet: 409 cannot unlink the primary while another exists', { skip }, async () => {
  const app = getApp()
  const u = await createUser(app)
  const primary = await link(app, u.row.id, { is_primary: true })
  await link(app, u.row.id, { is_primary: false })
  const res = await app.inject({
    method: 'POST', url: '/v1/auth/unlink-wallet', headers: authHeader(u.token),
    payload: { chain_ns: primary.chain_ns, address: primary.address },
  })
  assert.strictEqual(res.statusCode, 409)
})

test('unlink-wallet: 409 when the wallet is party to an active escrow', { skip }, async () => {
  const app = getApp()
  const u = await createUser(app)
  await link(app, u.row.id, { is_primary: true })
  const target = await link(app, u.row.id, { is_primary: false })
  await createEscrow(app, { creator_id: u.row.id, status: 'open' }) // solana namespace, active
  const res = await app.inject({
    method: 'POST', url: '/v1/auth/unlink-wallet', headers: authHeader(u.token),
    payload: { chain_ns: target.chain_ns, address: target.address },
  })
  assert.strictEqual(res.statusCode, 409)
  assert.ok(Array.isArray(res.json().details?.escrow_ids))
})

test('unlink-wallet: 200 unlinks a non-primary idle wallet', { skip }, async () => {
  const app = getApp()
  const u = await createUser(app)
  await link(app, u.row.id, { is_primary: true })
  const target = await link(app, u.row.id, { is_primary: false })
  const res = await app.inject({
    method: 'POST', url: '/v1/auth/unlink-wallet', headers: authHeader(u.token),
    payload: { chain_ns: target.chain_ns, address: target.address },
  })
  assert.strictEqual(res.statusCode, 200)
  assert.strictEqual(res.json().unlinked, true)
})

// ---------- set-primary-wallet ---------------------------------------------------

test('set-primary-wallet: 422 on invalid input', { skip }, async () => {
  const app = getApp()
  const u = await createUser(app)
  const res = await app.inject({
    method: 'POST', url: '/v1/auth/set-primary-wallet', headers: authHeader(u.token), payload: {},
  })
  assert.strictEqual(res.statusCode, 422)
})

test('set-primary-wallet: 404 when the wallet is not linked', { skip }, async () => {
  const app = getApp()
  const u = await createUser(app)
  const res = await app.inject({
    method: 'POST', url: '/v1/auth/set-primary-wallet', headers: authHeader(u.token),
    payload: { chain_ns: 'solana', address: 'Unknown1111111111111111111111111111111111' },
  })
  assert.strictEqual(res.statusCode, 404)
})

test('set-primary-wallet: 200 swaps the primary marker', { skip }, async () => {
  const app = getApp()
  const u = await createUser(app)
  await link(app, u.row.id, { is_primary: true })
  const next = await link(app, u.row.id, { is_primary: false })
  const res = await app.inject({
    method: 'POST', url: '/v1/auth/set-primary-wallet', headers: authHeader(u.token),
    payload: { chain_ns: next.chain_ns, address: next.address },
  })
  assert.strictEqual(res.statusCode, 200)
  assert.strictEqual(res.json().primary.address, next.address)
})
