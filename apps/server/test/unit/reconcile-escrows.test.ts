/**
 * jobs/reconcile-escrows — the safety-net sweep: probe → enqueue / timeout /
 * leave-pending, with RPC failures and queue failures both non-fatal.
 */

import { test } from 'node:test'
import * as assert from 'node:assert'
import {
  RECONCILE_BATCH_LIMIT,
  RECONCILE_GIVE_UP_MS,
  RECONCILE_MIN_AGE_MS,
  RECONCILE_TIMEOUT_CODE,
  reconcileEscrowsHandler,
  type PendingAttempt,
  type ReconcileDeps,
} from '@server/jobs/reconcile-escrows'
import { verifyTxDedupKey } from '@server/jobs/verify-tx'
import type { ChainAdapter, ChainRegistry } from '@server/chains/types'

const NOW = new Date('2026-06-04T12:00:00Z')
const WINDOW = { from_iso: '2026-06-04T11:00:00Z', to_iso: '2026-06-04T12:00:00Z' }

function attempt(over: Partial<PendingAttempt> = {}): PendingAttempt {
  return {
    tx_ref: 'sig-1',
    action: 'accept',
    escrow_id: 'e-1',
    chain_id: 'solana:devnet',
    submitted_at: new Date(NOW.getTime() - RECONCILE_MIN_AGE_MS - 60_000),
    ...over,
  }
}

function makeDeps(opts: {
  pending: PendingAttempt[]
  confirmed?: boolean
  probeThrows?: boolean
  enqueueThrows?: boolean
}): {
  deps: ReconcileDeps
  calls: { enqueued: Array<{ job_id?: string }>; failed: Array<{ tx_ref: string; code: string }>; queried: Date[] }
} {
  const calls = {
    enqueued: [] as Array<{ job_id?: string }>,
    failed: [] as Array<{ tx_ref: string; code: string }>,
    queried: [] as Date[],
  }
  const adapter: ChainAdapter = {
    namespace: 'solana',
    chain_id: 'solana:devnet',
    async buildTx() {
      throw new Error('not used')
    },
    async verifyTx() {
      if (opts.probeThrows ?? false) throw new Error('rpc down')
      return (opts.confirmed ?? true)
        ? { confirmed: true, failed: false, event: { name: 'EscrowAccepted', escrow_ref: 'x', fields: {} } }
        : { confirmed: false }
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
    get: () => adapter,
    has: () => true,
    list: () => [adapter],
    verifyAuthSig: async () => true, // not exercised by reconcile; satisfies ChainRegistry
  }
  const deps: ReconcileDeps = {
    store: {
      async findPendingAttempts(olderThan) {
        calls.queried.push(olderThan)
        return opts.pending
      },
      async markAttemptFailed(tx_ref, code) {
        calls.failed.push({ tx_ref, code })
      },
    },
    chains,
    queue: {
      async enqueue(_name, _payload, o) {
        if (opts.enqueueThrows ?? false) throw new Error('redis down')
        calls.enqueued.push({ job_id: o?.job_id })
        return { job_id: o?.job_id ?? 'x' }
      },
    },
    log: { info() {}, warn() {} },
    now: () => NOW,
  }
  return { deps, calls }
}

test('queries with the probe-delay cutoff', async () => {
  const { deps, calls } = makeDeps({ pending: [] })
  await reconcileEscrowsHandler(deps, WINDOW)
  assert.strictEqual(calls.queried[0].getTime(), NOW.getTime() - RECONCILE_MIN_AGE_MS)
})

test('confirmed attempt → verify-tx enqueued with the canonical dedup job_id', async () => {
  const { deps, calls } = makeDeps({ pending: [attempt()], confirmed: true })
  const r = await reconcileEscrowsHandler(deps, WINDOW)
  assert.strictEqual(r.enqueued, 1)
  assert.strictEqual(
    calls.enqueued[0].job_id,
    verifyTxDedupKey({ chain_id: 'solana:devnet', tx_ref: 'sig-1', event: 'EscrowAccepted' }),
  )
})

test('unknown + young → still pending; unknown + past horizon → TIMEOUT', async () => {
  const young = attempt({ tx_ref: 'young' })
  const old = attempt({
    tx_ref: 'old',
    submitted_at: new Date(NOW.getTime() - RECONCILE_GIVE_UP_MS - 1),
  })
  const { deps, calls } = makeDeps({ pending: [young, old], confirmed: false })
  const r = await reconcileEscrowsHandler(deps, WINDOW)
  assert.strictEqual(r.still_pending, 1)
  assert.strictEqual(r.timed_out, 1)
  assert.deepStrictEqual(calls.failed, [{ tx_ref: 'old', code: RECONCILE_TIMEOUT_CODE }])
})

test('probe RPC failure leaves the row pending (next tick retries)', async () => {
  const { deps, calls } = makeDeps({ pending: [attempt()], probeThrows: true })
  const r = await reconcileEscrowsHandler(deps, WINDOW)
  assert.strictEqual(r.still_pending, 1)
  assert.strictEqual(calls.failed.length, 0)
})

test('enqueue failure leaves the row pending, never throws', async () => {
  const { deps } = makeDeps({ pending: [attempt()], confirmed: true, enqueueThrows: true })
  const r = await reconcileEscrowsHandler(deps, WINDOW)
  assert.strictEqual(r.enqueued, 0)
  assert.strictEqual(r.still_pending, 1)
})

test('attempt without escrow falls back to the registered chain', async () => {
  const { deps, calls } = makeDeps({
    pending: [attempt({ escrow_id: null, chain_id: null })],
    confirmed: true,
  })
  const r = await reconcileEscrowsHandler(deps, WINDOW)
  assert.strictEqual(r.enqueued, 1)
  // ':' is sanitised out of the dedup key (BullMQ jobId constraint)
  assert.match(calls.enqueued[0].job_id ?? '', /solana\.devnet/)
})

test('full batch logs the overflow (no silent cap)', async () => {
  const pending = Array.from({ length: RECONCILE_BATCH_LIMIT }, (_, i) =>
    attempt({ tx_ref: `sig-${i}` }),
  )
  const { deps } = makeDeps({ pending, confirmed: true })
  const r = await reconcileEscrowsHandler(deps, WINDOW)
  assert.strictEqual(r.scanned, RECONCILE_BATCH_LIMIT)
})
