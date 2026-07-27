/**
 * jobs/verify-tx — the full Stage-2 pipeline: dedup → adapter verify →
 * status-guarded application → attempt stamping → best-effort republish.
 * Offline: fake adapter registry + in-memory stores.
 */

import { test } from 'node:test'
import * as assert from 'node:assert'
import {
  RetryableError,
  verifyTxJobHandler,
  verifyTxDedupKey,
  type VerifyTxDeps,
  type VerifyTxJobPayload,
  type VerifyTxStore,
} from '@server/jobs/verify-tx'
import type {
  ChainAdapter,
  ChainRegistry,
  DecodedEvent,
  VerifiedTx,
} from '@server/chains/types'
import type { EscrowEventStore, EscrowPatch } from '@server/lib/escrow-events'
import type { EscrowStatus } from '@server/lib/escrow'

const ESCROW_ID = '11111111-2222-4333-8444-555555555555'

function acceptedEvent(): DecodedEvent {
  return {
    name: 'EscrowAccepted',
    escrow_ref: 'Pda111',
    fields: {
      escrow_id: ESCROW_ID,
      counterparty: 'Cp111',
      completion_deadline: '1900007200',
      timestamp: '1900000000',
    },
  }
}

function makeDeps(opts: {
  processed?: boolean
  verdict?: VerifiedTx
  guardTrips?: boolean
  republishFails?: boolean
}): {
  deps: VerifyTxDeps
  calls: {
    confirmed: string[]
    failed: Array<{ tx_ref: string; code: string }>
    republished: Array<{ internal_event: string; escrow_id: string; tx_ref: string }>
    warned: string[]
    transitions: Array<{ from: EscrowStatus[]; patch: EscrowPatch }>
  }
} {
  const calls = {
    confirmed: [] as string[],
    failed: [] as Array<{ tx_ref: string; code: string }>,
    republished: [] as Array<{ internal_event: string; escrow_id: string; tx_ref: string }>,
    warned: [] as string[],
    transitions: [] as Array<{ from: EscrowStatus[]; patch: EscrowPatch }>,
  }
  const store: VerifyTxStore = {
    async isProcessed() {
      return opts.processed ?? false
    },
    async markAttemptConfirmed(tx_ref) {
      calls.confirmed.push(tx_ref)
    },
    async markAttemptFailed(tx_ref, code) {
      calls.failed.push({ tx_ref, code })
    },
  }
  const eventStore: EscrowEventStore = {
    async applyEvent({ from, patch }) {
      calls.transitions.push({ from, patch })
      return { applied: !(opts.guardTrips ?? false), passed_applicant_ids: [] }
    },
    async resolveUserByWallet() {
      return 'user-1'
    },
  }
  const adapter: ChainAdapter = {
    namespace: 'solana',
    chain_id: 'solana:devnet',
    escrowAddress: 'FakeProgram1111111111111111111111111111111',
    async buildTx() {
      throw new Error('not used')
    },
    async verifyTx() {
      return opts.verdict ?? { confirmed: true, failed: false, event: acceptedEvent() }
    },
    async verifyAuthSig() {
      return true
    },
    async fetchEscrowState() {
      return null
    },
    computeFee() {
      return '0'
    },
  }
  const chains: ChainRegistry = {
    get(chain_id) {
      assert.strictEqual(chain_id, 'solana:devnet')
      return adapter
    },
    has: () => true,
    list: () => [adapter],
    verifyAuthSig: async () => true, // not exercised by tx-verify; satisfies ChainRegistry
  }
  const deps: VerifyTxDeps = {
    store,
    chains,
    eventStore,
    async republish(e) {
      if (opts.republishFails ?? false) throw new Error('bus down')
      calls.republished.push({ internal_event: e.internal_event, escrow_id: e.escrow_id, tx_ref: e.tx_ref })
    },
    log: {
      warn(_obj, msg) {
        calls.warned.push(msg)
      },
    },
  }
  return { deps, calls }
}

function job(over: Partial<VerifyTxJobPayload> = {}): VerifyTxJobPayload {
  return {
    chain_id: 'solana:devnet',
    tx_ref: 'sig-abc',
    expected_event: 'EscrowAccepted',
    source: 'client-hint',
    ...over,
  }
}

test('already-processed tx_ref skips before touching the adapter', async () => {
  const { deps, calls } = makeDeps({ processed: true })
  const r = await verifyTxJobHandler(deps, job())
  assert.deepStrictEqual(r, { skipped: true, reason: 'already_processed' })
  assert.strictEqual(calls.transitions.length, 0)
})

test('unconfirmed tx throws RetryableError (BullMQ backoff)', async () => {
  const { deps } = makeDeps({ verdict: { confirmed: false, pending: true } })
  await assert.rejects(verifyTxJobHandler(deps, job()), RetryableError)
})

test('confirmed-but-failed tx marks the attempt failed and returns terminal', async () => {
  const { deps, calls } = makeDeps({
    verdict: { confirmed: true, failed: true, reason: 'custom error 6014' },
  })
  const r = await verifyTxJobHandler(deps, job())
  assert.ok(r.skipped === false && r.failed === true)
  assert.match(r.reason, /6014/)
  assert.deepStrictEqual(calls.failed, [{ tx_ref: 'sig-abc', code: 'TX_FAILED' }])
  assert.strictEqual(calls.transitions.length, 0)
})

test('irrelevant tx (program upgrade / non-escrow) skips clean — no failed attempt recorded', async () => {
  const { deps, calls } = makeDeps({
    verdict: { confirmed: true, irrelevant: true, reason: 'not an escrow instruction' },
  })
  const r = await verifyTxJobHandler(deps, job())
  assert.ok(r.skipped === true && r.reason === 'not_an_escrow_tx')
  // Terminal + inert: nothing marked failed/confirmed, nothing applied.
  assert.deepStrictEqual(calls.failed, [])
  assert.deepStrictEqual(calls.confirmed, [])
  assert.strictEqual(calls.transitions.length, 0)
})

test('happy path: applies the event, confirms the attempt, republishes snake_case', async () => {
  const { deps, calls } = makeDeps({})
  const r = await verifyTxJobHandler(deps, job())
  assert.ok(r.skipped === false && r.failed === false)
  assert.strictEqual(r.event, 'EscrowAccepted')
  assert.strictEqual(r.internal_event, 'escrow.accepted')
  assert.strictEqual(r.escrow_id, ESCROW_ID)
  assert.strictEqual(r.applied, true)
  assert.deepStrictEqual(calls.confirmed, ['sig-abc'])
  assert.deepStrictEqual(calls.republished, [
    { internal_event: 'escrow.accepted', escrow_id: ESCROW_ID, tx_ref: 'sig-abc' },
  ])
  assert.deepStrictEqual(calls.transitions[0].from, ['open'])
})

test('status-guard trip: attempt still confirmed, but no republish (no double fan-out)', async () => {
  const { deps, calls } = makeDeps({ guardTrips: true })
  const r = await verifyTxJobHandler(deps, job())
  assert.ok(r.skipped === false && r.failed === false)
  assert.strictEqual(r.applied, false)
  assert.deepStrictEqual(calls.confirmed, ['sig-abc'])
  assert.strictEqual(calls.republished.length, 0)
})

// Reaching the guard means step 1 already ruled out a replay of this tx_ref,
// so the transition genuinely did not fit: the events raced (verify-tx runs at
// concurrency 8, unserialised per escrow) or the row has drifted from chain.
// Nothing retries it and reconcile only revisits PENDING attempts, so if this
// is not logged the divergence is permanent AND invisible.
test('status-guard trip on a NEW tx is logged — it is dropped for good', async () => {
  const { deps, calls } = makeDeps({ guardTrips: true })
  await verifyTxJobHandler(deps, job())
  assert.strictEqual(calls.warned.length, 1)
})

// The counterweight: the ORDINARY duplicate (client-ping and the poller both
// verifying one tx) must stay silent, or the warning above is just noise and
// gets ignored. That path exits at step 1, well before the guard.
test('an already-processed tx_ref exits at step 1 and logs nothing', async () => {
  const { deps, calls } = makeDeps({ processed: true })
  const r = await verifyTxJobHandler(deps, job())
  assert.ok(r.skipped === true)
  assert.strictEqual(calls.warned.length, 0)
  assert.strictEqual(calls.republished.length, 0)
})

test('republish failure is logged, never thrown — state is already durable', async () => {
  const { deps, calls } = makeDeps({ republishFails: true })
  const r = await verifyTxJobHandler(deps, job())
  assert.ok(r.skipped === false && r.failed === false)
  assert.strictEqual(calls.warned.length, 1)
})

test('verifyTxDedupKey: deterministic and event-scoped', () => {
  const a = verifyTxDedupKey({ chain_id: 'solana:devnet', tx_ref: 's', event: 'EscrowCreated' })
  const b = verifyTxDedupKey({ chain_id: 'solana:devnet', tx_ref: 's', event: 'EscrowCreated' })
  const c = verifyTxDedupKey({ chain_id: 'solana:devnet', tx_ref: 's', event: 'EscrowAccepted' })
  assert.strictEqual(a, b)
  assert.notStrictEqual(a, c)
})

test('verifyTxDedupKey: BullMQ-safe — no ":" survives the CAIP-2 chain id', () => {
  // BullMQ rejects a custom jobId containing ':' ("Custom Id cannot contain :").
  const key = verifyTxDedupKey({ chain_id: 'solana:devnet', tx_ref: 'sig', event: 'Any' })
  assert.ok(!key.includes(':'), `dedup key must not contain ':' (got "${key}")`)
  // EVM chain ids (eip155:8453) carry a colon too — same guard.
  const evm = verifyTxDedupKey({ chain_id: 'eip155:8453', tx_ref: 'tx', event: 'Any' })
  assert.ok(!evm.includes(':'), `dedup key must not contain ':' (got "${evm}")`)
})

test('verifyTxDedupKey: distinct chains do not collide after sanitisation', () => {
  const devnet = verifyTxDedupKey({ chain_id: 'solana:devnet', tx_ref: 's', event: 'Any' })
  const mainnet = verifyTxDedupKey({ chain_id: 'solana:mainnet', tx_ref: 's', event: 'Any' })
  assert.notStrictEqual(devnet, mainnet)
})
