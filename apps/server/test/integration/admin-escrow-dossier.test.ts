/**
 * GET /v1/admin/escrows/:id/dossier (#Issue-1) — the full mediation context
 * behind a dispute: both parties (structural creator/counterparty identity),
 * amounts, the kind-specific detail record, submitted proofs (incl. the
 * exchange fiat payment proof), and the on-chain tx timeline.
 *
 * Real app via fastify.inject; gated on TEST_DATABASE_URL (helpers/test-app).
 */
import { test } from 'node:test'
import assert from 'node:assert'
import { eq } from 'drizzle-orm'
import { escrow_proofs, escrow_transactions, exchange_details } from '@tenda/shared/db/schema'
import {
  TEST_ASSET,
  TEST_CHAIN_ID,
  useTestApp,
  createUser,
  createEscrow,
  attachGigDetails,
  attachExchangeDetails,
  authHeader,
  TEST_DB_CONFIGURED,
} from '../helpers/test-app'
import { disputedEscrow, proofUrl } from '../helpers/escrow-states'

const skip = !TEST_DB_CONFIGURED
const getApp = useTestApp()

function dossierUrl(escrowId: string): string {
  return `/v1/admin/escrows/${escrowId}/dossier`
}

test('dossier: gig — parties, details, proofs and tx timeline', { skip }, async () => {
  const app = getApp()
  const { creator, worker, escrow } = await disputedEscrow(app)
  await attachGigDetails(app, escrow.id, { title: 'Fix my sink', category: 'service', remote: false })
  await app.db.insert(escrow_proofs).values([
    { escrow_id: escrow.id, url: proofUrl(worker.row.id, 1), type: 'image' },
    { escrow_id: escrow.id, url: proofUrl(worker.row.id, 2), type: 'document' },
  ])
  await app.db.insert(escrow_transactions).values([
    { escrow_id: escrow.id, type: 'create', tx_ref: 'ref-create', amount_raw: '5000000', actor_id: creator.row.id },
    { escrow_id: escrow.id, type: 'dispute', tx_ref: 'ref-dispute', actor_id: creator.row.id },
  ])

  const admin = await createUser(app, { role: 'dispute_admin' })
  const res = await app.inject({
    method: 'GET',
    url: dossierUrl(escrow.id),
    headers: authHeader(admin.token),
  })
  assert.strictEqual(res.statusCode, 200)
  const body = res.json()

  assert.strictEqual(body.kind, 'gig')
  assert.strictEqual(body.asset, TEST_ASSET)
  assert.strictEqual(body.chain_id, TEST_CHAIN_ID)

  // Parties are creator-first; the raiser (creator) is flagged.
  assert.deepStrictEqual(
    body.parties.map((p: { role: string; user_id: string; raised_dispute: boolean }) => [p.role, p.user_id, p.raised_dispute]),
    [
      ['creator', creator.row.id, true],
      ['counterparty', worker.row.id, false],
    ],
  )

  assert.strictEqual(body.gig.title, 'Fix my sink')
  assert.strictEqual(body.exchange, null)

  // Proofs preserve upload order and carry their kind.
  assert.deepStrictEqual(body.proofs.map((p: { type: string }) => p.type), ['image', 'document'])

  // Timeline is oldest-first.
  assert.deepStrictEqual(body.transactions.map((t: { type: string }) => t.type), ['create', 'dispute'])
})

test('dossier: exchange — surfaces the fiat payment proof, gig is null', { skip }, async () => {
  const app = getApp()
  const creator = await createUser(app)
  const worker = await createUser(app)
  const escrow = await createEscrow(app, {
    kind: 'exchange',
    creator_id: creator.row.id,
    counterparty_id: worker.row.id,
    status: 'disputed',
  })
  await attachExchangeDetails(app, escrow.id, { fiat_amount: '20000.0000', fiat_currency: 'NGN' })
  await app.db
    .update(exchange_details)
    .set({ payment_proof_url: 'https://res.cloudinary.com/test-cloud/image/upload/pay.jpg' })
    .where(eq(exchange_details.escrow_id, escrow.id))

  const admin = await createUser(app, { role: 'super_admin' })
  const res = await app.inject({ method: 'GET', url: dossierUrl(escrow.id), headers: authHeader(admin.token) })
  assert.strictEqual(res.statusCode, 200)
  const body = res.json()
  assert.strictEqual(body.kind, 'exchange')
  assert.strictEqual(body.gig, null)
  assert.strictEqual(body.exchange.fiat_currency, 'NGN')
  assert.strictEqual(body.exchange.payment_proof_url, 'https://res.cloudinary.com/test-cloud/image/upload/pay.jpg')
  assert.deepStrictEqual(body.proofs, [])
})

test('dossier: unaccepted escrow falls back to the pre-assigned counterparty', { skip }, async () => {
  const app = getApp()
  const creator = await createUser(app)
  const assigned = await createUser(app)
  const escrow = await createEscrow(app, {
    creator_id: creator.row.id,
    counterparty_id: null,
    assigned_counterparty_id: assigned.row.id,
    status: 'open',
  })

  const admin = await createUser(app, { role: 'dispute_admin' })
  const res = await app.inject({ method: 'GET', url: dossierUrl(escrow.id), headers: authHeader(admin.token) })
  assert.strictEqual(res.statusCode, 200)
  const parties = res.json().parties
  assert.strictEqual(parties.length, 2)
  assert.strictEqual(parties[1].role, 'counterparty')
  assert.strictEqual(parties[1].user_id, assigned.row.id)
})

test('dossier: solo escrow (no counterparty at all) returns only the creator', { skip }, async () => {
  const app = getApp()
  const creator = await createUser(app)
  const escrow = await createEscrow(app, {
    creator_id: creator.row.id,
    counterparty_id: null,
    assigned_counterparty_id: null,
    status: 'open',
  })
  const admin = await createUser(app, { role: 'dispute_admin' })
  const res = await app.inject({ method: 'GET', url: dossierUrl(escrow.id), headers: authHeader(admin.token) })
  assert.strictEqual(res.statusCode, 200)
  const parties = res.json().parties
  assert.strictEqual(parties.length, 1)
  assert.strictEqual(parties[0].role, 'creator')
})

test('dossier: 404 for an unknown escrow id', { skip }, async () => {
  const app = getApp()
  const admin = await createUser(app, { role: 'dispute_admin' })
  const res = await app.inject({
    method: 'GET',
    url: dossierUrl('00000000-0000-0000-0000-000000000000'),
    headers: authHeader(admin.token),
  })
  assert.strictEqual(res.statusCode, 404)
})

test('dossier: 403 for a caller without escrows.read', { skip }, async () => {
  const app = getApp()
  const { escrow } = await disputedEscrow(app)
  const normal = await createUser(app) // default role 'user'
  const res = await app.inject({ method: 'GET', url: dossierUrl(escrow.id), headers: authHeader(normal.token) })
  assert.strictEqual(res.statusCode, 403)
})
