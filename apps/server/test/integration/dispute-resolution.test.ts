/**
 * Issue-3 propose→sign resolution queue:
 *   POST /v1/admin/disputes/:id/resolution   — mediator proposes (claim-held)
 *   GET  /v1/admin/disputes/:id/resolution   — latest proposal / null
 *   GET  /v1/admin/resolutions?status=        — signing queue
 *   POST /v1/admin/resolutions/:id/reject     — key-holder returns it
 * plus the on-chain confirm hook (DisputeResolved → proposal 'confirmed').
 *
 * Real app via fastify.inject; gated on TEST_DATABASE_URL.
 */
import { test } from 'node:test'
import assert from 'node:assert'
import { eq } from 'drizzle-orm'
import { disputes, dispute_resolutions, escrows } from '@tenda/shared/db/schema'
import { drizzleEscrowEventStore } from '@server/lib/escrow-events'
import {
  TEST_DB_CONFIGURED,
  useTestApp,
  createUser,
  createEscrow,
  authHeader,
  FAKE_UNSIGNED,
  FAKE_DISPUTE_AUTHORITY,
  TEST_CHAIN_ID,
  type TestUser,
} from '../helpers/test-app'
import { disputedEscrow } from '../helpers/escrow-states'
import { buildResolveTx } from '@server/lib/escrow/resolve-tx'
import type { FastifyInstance } from 'fastify'

const skip = !TEST_DB_CONFIGURED
const getApp = useTestApp()

/** A disputed escrow whose dispute is already claimed by a fresh mediator. */
async function claimedDispute(app: FastifyInstance): Promise<{
  escrow_id: string
  dispute_id: string
  mediator: TestUser
}> {
  const { escrow, dispute_id } = await disputedEscrow(app)
  const mediator = await createUser(app, { role: 'dispute_admin' })
  const claim = await app.inject({
    method: 'POST',
    url: `/v1/admin/disputes/${dispute_id}/claim`,
    headers: authHeader(mediator.token),
  })
  assert.strictEqual(claim.statusCode, 200)
  return { escrow_id: escrow.id, dispute_id, mediator }
}

function propose(app: FastifyInstance, disputeId: string, token: string, winner = 'creator') {
  return app.inject({
    method: 'POST',
    url: `/v1/admin/disputes/${disputeId}/resolution`,
    headers: authHeader(token),
    payload: { winner },
  })
}

test('propose: a mediator not holding the claim is refused', { skip }, async () => {
  const app = getApp()
  const { dispute_id } = await disputedEscrow(app)
  const other = await createUser(app, { role: 'dispute_admin' })
  const res = await propose(app, dispute_id, other.token)
  assert.strictEqual(res.statusCode, 403)
  assert.strictEqual(res.json().code, 'DISPUTE_NOT_CLAIMED')
})

test('propose: claim-holder records a pending proposal, visible in queue + detail', { skip }, async () => {
  const app = getApp()
  const { dispute_id, mediator } = await claimedDispute(app)
  const res = await propose(app, dispute_id, mediator.token, 'counterparty')
  assert.strictEqual(res.statusCode, 200)
  const proposal = res.json()
  assert.strictEqual(proposal.status, 'pending')
  assert.strictEqual(proposal.proposed_winner, 'counterparty')
  assert.strictEqual(proposal.threshold, 1)

  // Detail endpoint returns the same proposal.
  const detail = await app.inject({
    method: 'GET',
    url: `/v1/admin/disputes/${dispute_id}/resolution`,
    headers: authHeader(mediator.token),
  })
  assert.strictEqual(detail.json().id, proposal.id)
  // The read carries the sign context so the panel can reactively gate signing.
  assert.strictEqual(detail.json().chain_id, TEST_CHAIN_ID)
  assert.strictEqual(detail.json().dispute_admin_authority, FAKE_DISPUTE_AUTHORITY)

  // Signing queue (default 'pending') includes it with escrow context.
  const queue = await app.inject({
    method: 'GET',
    url: '/v1/admin/resolutions',
    headers: authHeader(mediator.token),
  })
  assert.strictEqual(queue.statusCode, 200)
  const found = queue.json().data.find((r: { id: string }) => r.id === proposal.id)
  assert.ok(found, 'proposal appears in the pending queue')
  assert.strictEqual(found.kind, 'gig')

  // INVARIANT: a pending proposal must NOT resolve the dispute (thread live).
  const [d] = await app.db.select({ resolved_at: disputes.resolved_at }).from(disputes).where(eq(disputes.id, dispute_id))
  assert.strictEqual(d.resolved_at, null)
})

test('propose: a second proposal is rejected while one is active', { skip }, async () => {
  const app = getApp()
  const { dispute_id, mediator } = await claimedDispute(app)
  assert.strictEqual((await propose(app, dispute_id, mediator.token)).statusCode, 200)
  const dup = await propose(app, dispute_id, mediator.token, 'split')
  assert.strictEqual(dup.statusCode, 409)
  assert.strictEqual(dup.json().code, 'RESOLUTION_ALREADY_EXISTS')
})

test('propose: bad winner → 400', { skip }, async () => {
  const app = getApp()
  const { dispute_id, mediator } = await claimedDispute(app)
  const res = await propose(app, dispute_id, mediator.token, 'nobody')
  assert.strictEqual(res.statusCode, 400)
})

test('propose: escrow not in disputed status → 409', { skip }, async () => {
  const app = getApp()
  // Claim a dispute, then force the escrow out of 'disputed'.
  const { escrow_id, dispute_id, mediator } = await claimedDispute(app)
  await app.db.update(escrows).set({ status: 'accepted' }).where(eq(escrows.id, escrow_id))
  const res = await propose(app, dispute_id, mediator.token)
  assert.strictEqual(res.statusCode, 409)
  assert.strictEqual(res.json().code, 'ESCROW_WRONG_STATUS')
})

test('propose: already-resolved dispute → 409 DISPUTE_RESOLVED', { skip }, async () => {
  const app = getApp()
  const { dispute_id, mediator } = await claimedDispute(app)
  await app.db.update(disputes).set({ resolved_at: new Date(), winner: 'creator' }).where(eq(disputes.id, dispute_id))
  const res = await propose(app, dispute_id, mediator.token)
  assert.strictEqual(res.statusCode, 409)
  assert.strictEqual(res.json().code, 'DISPUTE_RESOLVED')
})

test('reject: a mediator without disputes.execute is refused', { skip }, async () => {
  const app = getApp()
  const { dispute_id, mediator } = await claimedDispute(app)
  const proposal = (await propose(app, dispute_id, mediator.token)).json()
  const res = await app.inject({
    method: 'POST',
    url: `/v1/admin/resolutions/${proposal.id}/reject`,
    headers: authHeader(mediator.token),
    payload: { reason: 'Wrong call, revisit the proofs' },
  })
  assert.strictEqual(res.statusCode, 403)
})

test('reject: a key-holder returns the proposal, reopening it for a new one', { skip }, async () => {
  const app = getApp()
  const { dispute_id, mediator } = await claimedDispute(app)
  const proposal = (await propose(app, dispute_id, mediator.token)).json()
  const signer = await createUser(app, { role: 'super_admin' })

  const rejected = await app.inject({
    method: 'POST',
    url: `/v1/admin/resolutions/${proposal.id}/reject`,
    headers: authHeader(signer.token),
    payload: { reason: 'The worker actually delivered; siding with counterparty' },
  })
  assert.strictEqual(rejected.statusCode, 200)
  assert.strictEqual(rejected.json().status, 'rejected')

  // Rejecting the same proposal again is a no-op conflict.
  const again = await app.inject({
    method: 'POST',
    url: `/v1/admin/resolutions/${proposal.id}/reject`,
    headers: authHeader(signer.token),
    payload: { reason: 'again' },
  })
  assert.strictEqual(again.statusCode, 409)
  assert.strictEqual(again.json().code, 'RESOLUTION_NOT_ACTIVE')

  // The dispute is reopened: a fresh proposal is allowed.
  const reproposed = await propose(app, dispute_id, mediator.token, 'counterparty')
  assert.strictEqual(reproposed.statusCode, 200)
})

test('reject: empty reason → 400, unknown id → 404', { skip }, async () => {
  const app = getApp()
  const signer = await createUser(app, { role: 'super_admin' })
  const { dispute_id, mediator } = await claimedDispute(app)
  const proposal = (await propose(app, dispute_id, mediator.token)).json()

  const empty = await app.inject({
    method: 'POST',
    url: `/v1/admin/resolutions/${proposal.id}/reject`,
    headers: authHeader(signer.token),
    payload: { reason: '   ' },
  })
  assert.strictEqual(empty.statusCode, 400)

  const missing = await app.inject({
    method: 'POST',
    url: `/v1/admin/resolutions/00000000-0000-0000-0000-000000000000/reject`,
    headers: authHeader(signer.token),
    payload: { reason: 'no such row' },
  })
  assert.strictEqual(missing.statusCode, 404)
})

test('queue: an invalid status filter → 400', { skip }, async () => {
  const app = getApp()
  const admin = await createUser(app, { role: 'dispute_admin' })
  const res = await app.inject({
    method: 'GET',
    url: '/v1/admin/resolutions?status=bogus',
    headers: authHeader(admin.token),
  })
  assert.strictEqual(res.statusCode, 400)
})

test('detail: no proposal yet returns null', { skip }, async () => {
  const app = getApp()
  const { dispute_id, mediator } = await claimedDispute(app)
  const res = await app.inject({
    method: 'GET',
    url: `/v1/admin/disputes/${dispute_id}/resolution`,
    headers: authHeader(mediator.token),
  })
  assert.strictEqual(res.statusCode, 200)
  assert.strictEqual(res.json(), null)
})

test('buildResolveTx: an escrow with no dispute record is a 409 (defensive)', { skip }, async () => {
  const app = getApp()
  const creator = await createUser(app)
  const escrow = await createEscrow(app, { creator_id: creator.row.id, status: 'disputed' })
  await assert.rejects(
    buildResolveTx(
      { db: app.db, chains: app.chains },
      { escrow_id: escrow.id, chain_id: escrow.chain_id, winner: 'creator', signer_user_id: creator.row.id },
    ),
    (e: unknown) => e instanceof Error && 'statusCode' in e && e.statusCode === 409,
  )
})

test('buildResolveTx: chain with no configured dispute authority → 409 CHAIN_NOT_CONFIGURED', { skip }, async () => {
  const app = getApp()
  const { escrow_id } = await claimedDispute(app)
  // An adapter that carries no dispute authority (e.g. the env var is unset):
  // the resolve build must refuse rather than fall back to a user's wallet.
  const base = app.chains.get(TEST_CHAIN_ID)
  const chains = { ...app.chains, get: () => ({ ...base, disputeAuthority: undefined }) }
  await assert.rejects(
    buildResolveTx(
      { db: app.db, chains },
      { escrow_id, chain_id: TEST_CHAIN_ID, winner: 'creator', signer_user_id: 'irrelevant' },
    ),
    (e: unknown) => e instanceof Error && 'code' in e && e.code === 'CHAIN_NOT_CONFIGURED',
  )
})

function executeBuild(app: FastifyInstance, resolutionId: string, token: string) {
  return app.inject({
    method: 'POST',
    url: `/v1/admin/resolutions/${resolutionId}/execute-build`,
    headers: authHeader(token),
  })
}

test('execute-build: a mediator without disputes.execute is refused', { skip }, async () => {
  const app = getApp()
  const { dispute_id, mediator } = await claimedDispute(app)
  const proposal = (await propose(app, dispute_id, mediator.token)).json()
  const res = await executeBuild(app, proposal.id, mediator.token)
  assert.strictEqual(res.statusCode, 403)
})

test('execute-build: signer gets the unsigned tx for the STORED winner and it goes executing', { skip }, async () => {
  const app = getApp()
  const { escrow_id, dispute_id, mediator } = await claimedDispute(app)
  // Mediator proposes 'split'; the signer must not be able to change that.
  const proposal = (await propose(app, dispute_id, mediator.token, 'split')).json()
  const signer = await createUser(app, { role: 'super_admin' })

  const res = await executeBuild(app, proposal.id, signer.token)
  assert.strictEqual(res.statusCode, 200)
  const body = res.json()
  assert.strictEqual(body.resolution_id, proposal.id)
  assert.strictEqual(body.escrow_id, escrow_id)
  assert.strictEqual(body.proposed_winner, 'split') // the reviewed winner, not a request input
  assert.deepStrictEqual(body.unsigned, FAKE_UNSIGNED)

  const [row] = await app.db.select().from(dispute_resolutions).where(eq(dispute_resolutions.id, proposal.id))
  assert.strictEqual(row.status, 'executing')

  // Re-building an already-executing proposal is idempotent (signer retries).
  const again = await executeBuild(app, proposal.id, signer.token)
  assert.strictEqual(again.statusCode, 200)
})

test('execute-build: escrow no longer disputed → 409', { skip }, async () => {
  const app = getApp()
  const { escrow_id, dispute_id, mediator } = await claimedDispute(app)
  const proposal = (await propose(app, dispute_id, mediator.token)).json()
  const signer = await createUser(app, { role: 'super_admin' })
  await app.db.update(escrows).set({ status: 'accepted' }).where(eq(escrows.id, escrow_id))
  const res = await executeBuild(app, proposal.id, signer.token)
  assert.strictEqual(res.statusCode, 409)
  assert.strictEqual(res.json().code, 'ESCROW_WRONG_STATUS')
})

test('execute-build: a rejected proposal cannot be built, unknown id → 404', { skip }, async () => {
  const app = getApp()
  const { dispute_id, mediator } = await claimedDispute(app)
  const proposal = (await propose(app, dispute_id, mediator.token)).json()
  const signer = await createUser(app, { role: 'super_admin' })
  await app.inject({
    method: 'POST',
    url: `/v1/admin/resolutions/${proposal.id}/reject`,
    headers: authHeader(signer.token),
    payload: { reason: 'not this outcome' },
  })
  const rejected = await executeBuild(app, proposal.id, signer.token)
  assert.strictEqual(rejected.statusCode, 409)
  assert.strictEqual(rejected.json().code, 'RESOLUTION_NOT_ACTIVE')

  const missing = await executeBuild(app, '00000000-0000-0000-0000-000000000000', signer.token)
  assert.strictEqual(missing.statusCode, 404)
})

function broadcast(app: FastifyInstance, resolutionId: string, token: string, tx_ref = 'sig-abc') {
  return app.inject({
    method: 'POST',
    url: `/v1/admin/resolutions/${resolutionId}/broadcast`,
    headers: authHeader(token),
    payload: { tx_ref },
  })
}

test('broadcast: rejected before the proposal has been built (still pending) → 409', { skip }, async () => {
  const app = getApp()
  const { dispute_id, mediator } = await claimedDispute(app)
  const proposal = (await propose(app, dispute_id, mediator.token)).json()
  const signer = await createUser(app, { role: 'super_admin' })
  const res = await broadcast(app, proposal.id, signer.token)
  assert.strictEqual(res.statusCode, 409)
  assert.strictEqual(res.json().code, 'RESOLUTION_NOT_ACTIVE')
})

test('broadcast: after build, a signer pings the tx ref and it queues (202)', { skip }, async () => {
  const app = getApp()
  const { dispute_id, mediator } = await claimedDispute(app)
  const proposal = (await propose(app, dispute_id, mediator.token)).json()
  const signer = await createUser(app, { role: 'super_admin' })
  await executeBuild(app, proposal.id, signer.token)
  const res = await broadcast(app, proposal.id, signer.token, 'sig-resolve-1')
  assert.strictEqual(res.statusCode, 202)
  assert.strictEqual(res.json().status, 'queued')
})

test('broadcast: missing tx_ref → 400; a mediator without execute → 403', { skip }, async () => {
  const app = getApp()
  const { dispute_id, mediator } = await claimedDispute(app)
  const proposal = (await propose(app, dispute_id, mediator.token)).json()
  const signer = await createUser(app, { role: 'super_admin' })
  await executeBuild(app, proposal.id, signer.token)

  const noRef = await broadcast(app, proposal.id, signer.token, '')
  assert.strictEqual(noRef.statusCode, 400)

  const forbidden = await broadcast(app, proposal.id, mediator.token, 'sig-x')
  assert.strictEqual(forbidden.statusCode, 403)
})

test('execute-build → confirm hook: an executing proposal confirms on DisputeResolved', { skip }, async () => {
  const app = getApp()
  const { escrow_id, dispute_id, mediator } = await claimedDispute(app)
  const proposal = (await propose(app, dispute_id, mediator.token, 'counterparty')).json()
  const signer = await createUser(app, { role: 'super_admin' })
  assert.strictEqual((await executeBuild(app, proposal.id, signer.token)).statusCode, 200)

  const store = drizzleEscrowEventStore(app.db)
  await store.applyEvent({
    escrow_id,
    from: ['disputed'],
    patch: { status: 'resolved' },
    transaction: { type: 'resolve', tx_ref: `resolve-${escrow_id}`, amount_raw: null, platform_fee_raw: null, creator_payout_raw: null, actor_id: null },
    disputeResolution: { winner: 'counterparty' },
  })
  const [row] = await app.db.select().from(dispute_resolutions).where(eq(dispute_resolutions.id, proposal.id))
  assert.strictEqual(row.status, 'confirmed')
  assert.strictEqual(row.resolved_tx_ref, `resolve-${escrow_id}`)
})

test('confirm hook: DisputeResolved marks the active proposal confirmed', { skip }, async () => {
  const app = getApp()
  const { escrow_id, dispute_id, mediator } = await claimedDispute(app)
  const proposal = (await propose(app, dispute_id, mediator.token, 'split')).json()

  // Simulate the verify-tx apply path landing the on-chain resolution.
  const store = drizzleEscrowEventStore(app.db)
  const applied = await store.applyEvent({
    escrow_id,
    from: ['disputed'],
    patch: { status: 'resolved' },
    transaction: { type: 'resolve', tx_ref: `resolve-${escrow_id}`, amount_raw: null, platform_fee_raw: null, creator_payout_raw: null, actor_id: null },
    disputeResolution: { winner: 'split' },
  })
  assert.strictEqual(applied, true)

  const [row] = await app.db.select().from(dispute_resolutions).where(eq(dispute_resolutions.id, proposal.id))
  assert.strictEqual(row.status, 'confirmed')
  assert.strictEqual(row.resolved_tx_ref, `resolve-${escrow_id}`)

  // And the dispute is now resolved (thread freezes) — set by the apply path.
  const [d] = await app.db.select({ resolved_at: disputes.resolved_at, winner: disputes.winner }).from(disputes).where(eq(disputes.id, dispute_id))
  assert.notStrictEqual(d.resolved_at, null)
  assert.strictEqual(d.winner, 'split')
})
