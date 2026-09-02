/**
 * Claiming, against a real database (#53c-1).
 *
 * The unit suites drive the service through hand-written stores, so they prove
 * the orchestration and nothing about the SQL. What needs postgres is what the
 * fakes were free to invent: that a claim RECORDS who was paid and who paid,
 * that the "never twice" property is a primary key rather than a fixture, and
 * that the off-switch table reads the way the evaluator assumes.
 *
 * Gated on TEST_DATABASE_URL.
 */
import { test } from 'node:test'
import assert from 'node:assert'
import { and, eq } from 'drizzle-orm'
import { gas_grants, gas_seed_settings } from '@tenda/shared/db/schema/gas-seed'
import {
  buildGasSeedClaimDeps,
  buildGasSeedJobDeps,
  resetGasSeedFunderCache,
  claimGasSeed,
  drizzleGasSeedClaimStore,
  gasSeedAvailability,
  gasSeedJobId,
  pendingTxRef,
} from '@server/features/gas-seed'
import { TEST_DB_CONFIGURED, useTestApp, createUser } from '../helpers/test-app'
import { installCapture } from '../helpers/side-effects'
import {
  AMOUNT,
  CHAIN,
  FUNDER,
  deps,
  eligibleUser,
  withSeedableChain,
} from '../helpers/gas-seed-claim-db'

const skip = !TEST_DB_CONFIGURED
const getApp = useTestApp()

// ---------- what a claim actually writes -----------------------------------------

test('a claim records the paid wallet AND the paying hot wallet, per grant', { skip }, async () => {
  const app = getApp()
  await withSeedableChain(app)
  const user = await eligibleUser(app)

  const res = await claimGasSeed(deps(app), { user_id: user.id, client: 'mobile' }, CHAIN)
  assert.strictEqual(res.queued, true)

  const [row] = await app.db
    .select()
    .from(gas_grants)
    .where(and(eq(gas_grants.user_id, user.id), eq(gas_grants.chain_id, CHAIN)))

  assert.ok(row, 'the claim wrote no grant row')
  assert.strictEqual(row.wallet_address, user.wallet)
  // The rotation fix: per-grant, so rolling the key later cannot retroactively
  // flag this grant as funded by the wrong wallet.
  assert.strictEqual(row.funder_address, FUNDER)
  assert.strictEqual(row.amount_raw, AMOUNT)
  assert.strictEqual(row.tx_ref, pendingTxRef(user.id, CHAIN))
})

test('the PRIMARY KEY is what stops a double pay, not the fake in the unit suite', { skip }, async () => {
  const app = getApp()
  await withSeedableChain(app)
  const user = await eligibleUser(app)
  const identity = { user_id: user.id, client: 'mobile' as const }

  const first = await claimGasSeed(deps(app), identity, CHAIN)
  const second = await claimGasSeed(deps(app), identity, CHAIN)

  assert.strictEqual(first.queued, true)
  assert.strictEqual(second.queued, false)
  assert.strictEqual(second.state, 'in_progress')

  const rows = await app.db.select().from(gas_grants).where(eq(gas_grants.user_id, user.id))
  assert.strictEqual(rows.length, 1, 'two grant rows for one user on one chain')
})

// ---------- the off switch ---------------------------------------------------------

test('an absent settings row means ENABLED — a new chain needs no row', { skip }, async () => {
  const app = getApp()
  await withSeedableChain(app)
  const user = await eligibleUser(app)

  const res = await gasSeedAvailability(deps(app), { user_id: user.id, client: 'mobile' })
  assert.strictEqual(res.chains.find((c) => c.chain_id === CHAIN)?.available, true)
  assert.deepStrictEqual(await drizzleGasSeedClaimStore(app.db).disabledChains(), new Set())
})

test('switching claims off for a chain refuses it, without a deploy or a restart', { skip }, async () => {
  const app = getApp()
  await withSeedableChain(app)
  const user = await eligibleUser(app)
  await app.db.insert(gas_seed_settings).values({ chain_id: CHAIN, claims_enabled: false })

  const res = await gasSeedAvailability(deps(app), { user_id: user.id, client: 'mobile' })
  const verdict = res.chains.find((c) => c.chain_id === CHAIN)
  assert.strictEqual(verdict?.available, false)
  assert.strictEqual(verdict.reason, 'claims_disabled')

  // And switching it back on needs no restart either — the read is per request.
  await app.db
    .update(gas_seed_settings)
    .set({ claims_enabled: true })
    .where(eq(gas_seed_settings.chain_id, CHAIN))
  const after = await gasSeedAvailability(deps(app), { user_id: user.id, client: 'mobile' })
  assert.strictEqual(after.chains.find((c) => c.chain_id === CHAIN)?.available, true)
})

test('an ENABLED row is not in the disabled set — only exceptions are stored', { skip }, async () => {
  const app = getApp()
  await withSeedableChain(app)
  await app.db.insert(gas_seed_settings).values({ chain_id: CHAIN, claims_enabled: true })
  assert.deepStrictEqual(await drizzleGasSeedClaimStore(app.db).disabledChains(), new Set())
})

// ---------- what the JOB reads back ------------------------------------------------

test('findClaimedGrant returns what was PROMISED: amount, wallet and placeholder', { skip }, async () => {
  // The job pays from this row rather than from config, so these three fields
  // are the contract between the claim and the transfer.
  const app = getApp()
  await withSeedableChain(app)
  const user = await eligibleUser(app)
  await claimGasSeed(deps(app), { user_id: user.id, client: 'mobile' }, CHAIN)

  const grant = await drizzleGasSeedClaimStore(app.db).findClaimedGrant(user.id, CHAIN)
  assert.deepStrictEqual(grant, {
    tx_ref: pendingTxRef(user.id, CHAIN),
    amount_raw: AMOUNT,
    wallet_address: user.wallet,
  })
})

test('findClaimedGrant is null for a user who never claimed, and scoped per chain', { skip }, async () => {
  const app = getApp()
  await withSeedableChain(app)
  const user = await eligibleUser(app)
  const store = drizzleGasSeedClaimStore(app.db)

  assert.strictEqual(await store.findClaimedGrant(user.id, CHAIN), null)
  await claimGasSeed(deps(app), { user_id: user.id, client: 'mobile' }, CHAIN)
  // Claimed on 0G; another chain must not read back that grant.
  assert.strictEqual(await store.findClaimedGrant(user.id, 'solana:devnet'), null)
  assert.notStrictEqual(await store.findClaimedGrant(user.id, CHAIN), null)
})

// ---------- the live wiring --------------------------------------------------------

test('the live deps builders assemble against a booted app', { skip }, async () => {
  // `buildGasSeedClaimDeps` runs on every request to these endpoints and reads
  // chain secrets, so "does it assemble at all" is worth one assertion — a
  // throw here would be a 500 on the route rather than a refusal.
  const app = getApp()
  const claimDeps = buildGasSeedClaimDeps(app)
  const jobDeps = buildGasSeedJobDeps(app)

  assert.strictEqual(typeof claimDeps.seed.findSeedableChains, 'function')
  assert.strictEqual(typeof claimDeps.claim.claimantFacts, 'function')
  assert.strictEqual(typeof jobDeps.notify, 'function')
  // Funders and senders are built from the same secrets, so a deployment that
  // can send can also report a balance — the pairing the unit suite asserts
  // over fixtures, here over whatever this environment actually configured.
  assert.deepStrictEqual([...claimDeps.funders.keys()].sort(), [...jobDeps.senders.keys()].sort())
})

test('the job deps notify through the app\'s real notification path', { skip }, async () => {
  // `notify` is a closure over `enqueueNotification`, so nothing but driving it
  // proves the seed's notice reaches the same queue every other notice uses —
  // and that its `data` bag carries what a client would route on.
  const app = getApp()
  await withSeedableChain(app)
  const user = await createUser(app)
  const capture = installCapture(app)

  await buildGasSeedJobDeps(app).notify({
    user_id: user.row.id,
    chain_id: CHAIN,
    amount_raw: AMOUNT,
    tx_ref: '0xrealhash',
  })

  const [notice] = capture.notifications()
  assert.ok(notice, 'the granted seed produced no notification')
  assert.strictEqual(notice.user_id, user.row.id)
  // The chain is named from the manifest, so a new chain needs no copy here.
  assert.match(notice.body, /0G/)
  assert.deepStrictEqual(notice.data, {
    kind: 'gas_seed',
    chain_id: CHAIN,
    tx_ref: '0xrealhash',
  })
  // No amount in the copy: the manifest carries no native symbol or decimals,
  // and a seed announced in the wrong magnitude is worse than one with no number.
  assert.doesNotMatch(notice.body, new RegExp(AMOUNT))
})

test('the claim deps enqueue onto the gas-seed queue, keyed for dedup', { skip }, async () => {
  const app = getApp()
  const capture = installCapture(app)
  const claimDeps = buildGasSeedClaimDeps(app)

  if (claimDeps.enqueue === null) {
    // No REDIS_URL in this environment: the null itself is the behaviour, and
    // the claim service's unit suite proves it refuses rather than accepts.
    assert.strictEqual(claimDeps.enqueue, null)
    return
  }
  await claimDeps.enqueue({ user_id: 'u-1', chain_id: CHAIN })
  const [job] = capture.enqueued
  assert.ok(job)
  assert.strictEqual(job.name, 'gas-seed')
  assert.deepStrictEqual(job.payload, { user_id: 'u-1', chain_id: CHAIN })
  assert.strictEqual(job.opts?.job_id, gasSeedJobId({ user_id: 'u-1', chain_id: CHAIN }))
})

test('the funder cache is built ONCE for the process, not once per request', { skip }, async () => {
  // The bug this exists for: `buildGasSeedClaimDeps` runs on every request to
  // these endpoints, so a cache built inside it is a brand-new empty cache each
  // time — every availability read pays its RPC round trip and the TTL never
  // hits. Nothing observable from outside changes, which is why only the
  // identity of the map can show it.
  const app = getApp()
  resetGasSeedFunderCache()
  const first = buildGasSeedClaimDeps(app).funders
  const second = buildGasSeedClaimDeps(app).funders
  assert.strictEqual(first, second, 'a second request rebuilt the funder cache from scratch')

  // And the reset really resets, or this assertion would pass on a cache that
  // was simply never rebuilt for any reason.
  resetGasSeedFunderCache()
  assert.notStrictEqual(buildGasSeedClaimDeps(app).funders, first)
})
