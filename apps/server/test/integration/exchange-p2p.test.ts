/**
 * CO4 (#73): exchange offer creation + p2p onramp.
 *   POST /v1/exchange — attach offer terms to a draft (ownership/kind/
 *     status guards, numeric validation, draft-window upsert)
 *   POST /v1/fiat/quote|onramp — buyer quotes route to LIVE sell offers
 *     (no offer → no quote; own offers excluded; quote = offer terms;
 *     initiate hands back the matched offer id)
 *
 * Real app via fastify.inject; gated on TEST_DATABASE_URL (helpers/test-app).
 */
import { test } from 'node:test'
import assert from 'node:assert'
import { eq } from 'drizzle-orm'
import type { FastifyInstance } from 'fastify'
import { escrows } from '@tenda/shared/db/schema'
import { buildProviders } from '@server/features/fiat-rails'
import {
  TEST_DB_CONFIGURED,
  TEST_CHAIN_ID,
  TEST_NATIVE_ASSET,
  useTestApp,
  createUser,
  createEscrow,
  attachExchangeDetails,
  authHeader,
  type TestUser,
} from '../helpers/test-app'

const skip = !TEST_DB_CONFIGURED
const getApp = useTestApp()

/** The live p2p provider over the harness DB (status-mapping tests). */
function p2pProvider(app: FastifyInstance) {
  const provider = buildProviders(app).get('p2p_internal')
  assert.ok(provider !== undefined)
  return provider
}

// ---------- POST /v1/exchange ---------------------------------------------------

function offerBody(escrow_id: string, overrides: Record<string, unknown> = {}) {
  return { escrow_id, fiat_amount: 15_000, fiat_currency: 'NGN', rate: 1_500, ...overrides }
}

test('POST /v1/exchange: validation — amount, rate, currency, window', { skip }, async () => {
  const app = getApp()
  const u = await createUser(app)
  const escrow = await createEscrow(app, { creator_id: u.row.id, kind: 'exchange' })
  const post = (payload: Record<string, unknown>) =>
    app.inject({ method: 'POST', url: '/v1/exchange', headers: authHeader(u.token), payload })

  assert.strictEqual((await post(offerBody(escrow.id, { fiat_amount: -5 }))).statusCode, 400)
  assert.strictEqual((await post(offerBody(escrow.id, { rate: 0 }))).statusCode, 400)
  assert.strictEqual((await post(offerBody(escrow.id, { fiat_currency: 'XXX' }))).statusCode, 400)
  assert.strictEqual(
    (await post(offerBody(escrow.id, { payment_window_seconds: 60 }))).statusCode,
    400,
  )
})

test('POST /v1/exchange: 403 non-creator, 409 gig escrow, 409 published', { skip }, async () => {
  const app = getApp()
  const u = await createUser(app)
  const stranger = await createUser(app)
  const exchange = await createEscrow(app, { creator_id: u.row.id, kind: 'exchange' })
  const gig = await createEscrow(app, { creator_id: u.row.id })
  const open = await createEscrow(app, { creator_id: u.row.id, kind: 'exchange', status: 'open' })

  const foreign = await app.inject({
    method: 'POST',
    url: '/v1/exchange',
    headers: authHeader(stranger.token),
    payload: offerBody(exchange.id),
  })
  assert.strictEqual(foreign.statusCode, 403)

  const wrongKind = await app.inject({
    method: 'POST',
    url: '/v1/exchange',
    headers: authHeader(u.token),
    payload: offerBody(gig.id),
  })
  assert.strictEqual(wrongKind.statusCode, 409)

  const published = await app.inject({
    method: 'POST',
    url: '/v1/exchange',
    headers: authHeader(u.token),
    payload: offerBody(open.id),
  })
  assert.strictEqual(published.statusCode, 409)
})

test('POST /v1/exchange: 201, and the draft upsert retries clean', { skip }, async () => {
  const app = getApp()
  const u = await createUser(app)
  const escrow = await createEscrow(app, { creator_id: u.row.id, kind: 'exchange' })
  const first = await app.inject({
    method: 'POST',
    url: '/v1/exchange',
    headers: authHeader(u.token),
    payload: offerBody(escrow.id),
  })
  assert.strictEqual(first.statusCode, 201)
  assert.strictEqual(first.json().fiat_currency, 'NGN')

  const retry = await app.inject({
    method: 'POST',
    url: '/v1/exchange',
    headers: authHeader(u.token),
    payload: offerBody(escrow.id, { rate: 1_550 }),
  })
  assert.strictEqual(retry.statusCode, 201)
  assert.strictEqual(retry.json().rate, '1550.0000000000')
})

// ---------- p2p onramp ------------------------------------------------------------

/** Live SOL_DEVNET sell offer: 6.5 SOL for 10,000 NGN. */
async function liveSellOffer(app: ReturnType<typeof getApp>, seller: TestUser, fiat = 10_000) {
  const escrow = await createEscrow(app, {
    creator_id: seller.row.id,
    kind: 'exchange',
    status: 'open',
    asset: TEST_NATIVE_ASSET,
    amount_raw: '6500000000',
  })
  await attachExchangeDetails(app, escrow.id, {
    fiat_amount: fiat.toFixed(4),
    fiat_currency: 'NGN',
    rate: '1538.4600000000',
  })
  return escrow
}

function quoteBody(fiat_amount: number) {
  return {
    direction: 'onramp',
    fiat_currency: 'NGN',
    fiat_amount,
    asset: TEST_NATIVE_ASSET,
    chain_id: TEST_CHAIN_ID,
    wallet_address: 'BuyerWallet1111111111111111111111111111111',
  }
}

test('p2p onramp: no live offers → 503 PROVIDER_UNAVAILABLE', { skip }, async () => {
  const app = getApp()
  const buyer = await createUser(app)
  const res = await app.inject({
    method: 'POST',
    url: '/v1/fiat/quote',
    headers: authHeader(buyer.token),
    payload: quoteBody(10_000),
  })
  assert.strictEqual(res.statusCode, 503)
})

test('p2p onramp: own offers and out-of-tolerance sizes never match', { skip }, async () => {
  const app = getApp()
  const buyer = await createUser(app)
  // own offer — exact size, still excluded
  await liveSellOffer(app, buyer, 10_000)
  const own = await app.inject({
    method: 'POST',
    url: '/v1/fiat/quote',
    headers: authHeader(buyer.token),
    payload: quoteBody(10_000),
  })
  assert.strictEqual(own.statusCode, 503)

  // someone else's offer but 3x the requested size — outside ±10%
  const seller = await createUser(app)
  await liveSellOffer(app, seller, 30_000)
  const oversized = await app.inject({
    method: 'POST',
    url: '/v1/fiat/quote',
    headers: authHeader(buyer.token),
    payload: quoteBody(10_000),
  })
  assert.strictEqual(oversized.statusCode, 503)
})

test('p2p onramp: quote mirrors the offer; initiate hands back its id', { skip }, async () => {
  const app = getApp()
  const buyer = await createUser(app)
  const seller = await createUser(app)
  const offer = await liveSellOffer(app, seller, 10_000)

  const quoted = await app.inject({
    method: 'POST',
    url: '/v1/fiat/quote',
    headers: authHeader(buyer.token),
    payload: quoteBody(9_800), // within ±10% of the 10,000 offer
  })
  assert.strictEqual(quoted.statusCode, 200)
  const quote = quoted.json()
  assert.strictEqual(quote.provider, 'p2p_internal')
  assert.strictEqual(quote.fiat_amount, 10_000) // the OFFER's exact terms
  assert.strictEqual(quote.asset_amount_raw, '6500000000')

  const initiated = await app.inject({
    method: 'POST',
    url: '/v1/fiat/onramp',
    headers: authHeader(buyer.token),
    payload: { intent_id: quote.intent_id },
  })
  assert.strictEqual(initiated.statusCode, 200)
  assert.deepStrictEqual(initiated.json().instruction, { kind: 'p2p', offer_id: offer.id })
})

test('p2p onramp: matched offer taken before initiate → 503', { skip }, async () => {
  const app = getApp()
  const buyer = await createUser(app)
  const seller = await createUser(app)
  const rival = await createUser(app)
  const offer = await liveSellOffer(app, seller, 10_000)

  const quoted = await app.inject({
    method: 'POST',
    url: '/v1/fiat/quote',
    headers: authHeader(buyer.token),
    payload: quoteBody(10_000),
  })
  assert.strictEqual(quoted.statusCode, 200)

  // a rival accepts the offer first (status leaves 'open')
  await app.db
    .update(escrows)
    .set({ status: 'accepted', counterparty_id: rival.row.id })
    .where(eq(escrows.id, offer.id))

  const initiated = await app.inject({
    method: 'POST',
    url: '/v1/fiat/onramp',
    headers: authHeader(buyer.token),
    payload: { intent_id: quoted.json().intent_id },
  })
  assert.strictEqual(initiated.statusCode, 503)
})

test('p2p status: an onramp intent only completes with ITS buyer', { skip }, async () => {
  const app = getApp()
  const provider = p2pProvider(app)

  const buyer = await createUser(app)
  const rival = await createUser(app)
  const seller = await createUser(app)
  const offer = await liveSellOffer(app, seller, 10_000)
  const asBuyer = { user_id: buyer.row.id, direction: 'onramp' as const }

  // live and unclaimed → still pending
  assert.strictEqual(await provider.status(offer.id, asBuyer), 'pending')

  // the RIVAL accepts → this buyer's match is gone
  await app.db
    .update(escrows)
    .set({ status: 'accepted', counterparty_id: rival.row.id })
    .where(eq(escrows.id, offer.id))
  assert.strictEqual(await provider.status(offer.id, asBuyer), 'failed')

  // ...and the rival completing it must NOT settle this buyer's intent
  await app.db.update(escrows).set({ status: 'completed' }).where(eq(escrows.id, offer.id))
  assert.strictEqual(await provider.status(offer.id, asBuyer), 'failed')
  // while the offramp view (the seller's own intent) correctly completes
  assert.strictEqual(
    await provider.status(offer.id, { user_id: seller.row.id, direction: 'offramp' }),
    'completed',
  )

  // a fresh offer accepted by THIS buyer stays pending, then completes
  const mine = await liveSellOffer(app, seller, 10_000)
  await app.db
    .update(escrows)
    .set({ status: 'accepted', counterparty_id: buyer.row.id })
    .where(eq(escrows.id, mine.id))
  assert.strictEqual(await provider.status(mine.id, asBuyer), 'pending')
  await app.db.update(escrows).set({ status: 'completed' }).where(eq(escrows.id, mine.id))
  assert.strictEqual(await provider.status(mine.id, asBuyer), 'completed')
})

test('p2p status: a dead open offer fails the onramp intent (hidden / lapsed)', { skip }, async () => {
  const app = getApp()
  const provider = p2pProvider(app)

  const buyer = await createUser(app)
  const seller = await createUser(app)
  const asBuyer = { user_id: buyer.row.id, direction: 'onramp' as const }

  const hiddenOffer = await liveSellOffer(app, seller, 10_000)
  await app.db.update(escrows).set({ hidden: true }).where(eq(escrows.id, hiddenOffer.id))
  assert.strictEqual(await provider.status(hiddenOffer.id, asBuyer), 'failed')

  const cancelled = await liveSellOffer(app, seller, 10_000)
  await app.db.update(escrows).set({ status: 'cancelled' }).where(eq(escrows.id, cancelled.id))
  assert.strictEqual(await provider.status(cancelled.id, asBuyer), 'failed')
})

// ---------- advanced-mode gate + new-offer deadline stamping ------------------

test('PATCH /users/me: advanced_mode_enabled toggles on and off; non-boolean 422', { skip }, async () => {
  const app = getApp()
  const u = await createUser(app)

  const on = await app.inject({
    method: 'PATCH',
    url: '/v1/users/me',
    headers: authHeader(u.token),
    payload: { advanced_mode_enabled: true },
  })
  assert.strictEqual(on.statusCode, 200)
  assert.strictEqual(on.json().user.advanced_mode_enabled, true)

  const off = await app.inject({
    method: 'PATCH',
    url: '/v1/users/me',
    headers: authHeader(u.token),
    payload: { advanced_mode_enabled: false },
  })
  assert.strictEqual(off.json().user.advanced_mode_enabled, false)

  const bad = await app.inject({
    method: 'PATCH',
    url: '/v1/users/me',
    headers: authHeader(u.token),
    payload: { advanced_mode_enabled: 'yes' },
  })
  assert.strictEqual(bad.statusCode, 422)
})

test('p2p offramp: server-opened offers are publishable as-is (deadlines stamped)', { skip }, async () => {
  const app = getApp()
  const seller = await createUser(app)
  const provider = p2pProvider(app)

  const before = Date.now()
  const { instruction } = await provider.initiate({
    quote_ref: 'q-offramp',
    user_id: seller.row.id,
    wallet_address: 'SellerWallet111111111111111111111111111111',
    direction: 'offramp',
    quote: {
      fiat_currency: 'NGN',
      fiat_amount: 10_000,
      asset: TEST_NATIVE_ASSET,
      asset_amount_raw: '6500000000',
      rate: 1538.46,
    },
  })
  assert.ok('kind' in instruction && instruction.kind === 'p2p')
  const offer_id = (instruction as { kind: 'p2p'; offer_id: string }).offer_id

  const [row] = await app.db.select().from(escrows).where(eq(escrows.id, offer_id))
  assert.strictEqual(row.status, 'draft')
  assert.strictEqual(row.completion_duration_seconds, 86_400) // payment window
  assert.ok((row.accept_deadline?.getTime() ?? 0) > before) // stamped, future

  // ...and build-create accepts it without needing the backfill path
  const published = await app.inject({
    method: 'POST',
    url: `/v1/escrows/${offer_id}/build-create`,
    headers: authHeader(seller.token),
  })
  assert.strictEqual(published.statusCode, 200)
})

test('POST /v1/exchange: absurd terms hit the validation rails, not the driver', { skip }, async () => {
  const app = getApp()
  const u = await createUser(app)
  const escrow = await createEscrow(app, { creator_id: u.row.id, kind: 'exchange' })
  const post = (payload: Record<string, unknown>) =>
    app.inject({ method: 'POST', url: '/v1/exchange', headers: authHeader(u.token), payload })

  const hugeFiat = await post(offerBody(escrow.id, { fiat_amount: 1e18 }))
  assert.strictEqual(hugeFiat.statusCode, 400)
  const hugeRate = await post(offerBody(escrow.id, { rate: 1e12 }))
  assert.strictEqual(hugeRate.statusCode, 400)
})
