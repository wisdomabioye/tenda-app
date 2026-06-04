/**
 * lib/tx-attempts — client-ping intake: idempotent insert + best-effort
 * verify-tx enqueue with the documented degradation path (queue down →
 * recorded but not enqueued, never thrown).
 */

import { test } from 'node:test'
import * as assert from 'node:assert'
import { dedupKey } from '@server/core/queue/idempotency'
import {
  recordTxAttempt,
  type RecordTxAttemptDeps,
  type RecordTxAttemptInput,
  type TxAttemptRow,
} from '@server/lib/tx-attempts'
import type { JobPayload } from '@server/plugins/queue'

interface EnqueueCall {
  name: string
  payload: JobPayload['verify-tx']
  job_id?: string
}

function makeDeps(opts: { duplicate?: boolean; queueDown?: boolean } = {}): {
  deps: RecordTxAttemptDeps
  inserts: TxAttemptRow[]
  calls: EnqueueCall[]
  warns: string[]
} {
  const inserts: TxAttemptRow[] = []
  const calls: EnqueueCall[] = []
  const warns: string[] = []
  const deps: RecordTxAttemptDeps = {
    store: {
      async insertAttempt(row) {
        inserts.push(row)
        return !(opts.duplicate ?? false)
      },
    },
    queue: {
      async enqueue(name, payload, o) {
        if (opts.queueDown ?? false) throw new Error('BullMQ not provisioned')
        calls.push({ name, payload: payload as JobPayload['verify-tx'], job_id: o?.job_id })
        return { job_id: o?.job_id ?? 'generated' }
      },
    },
    log: {
      warn(_obj, msg) {
        warns.push(msg)
      },
    },
  }
  return { deps, inserts, calls, warns }
}

function input(over: Partial<RecordTxAttemptInput> = {}): RecordTxAttemptInput {
  return {
    user_id: 'u-1',
    escrow_id: 'e-1',
    action: 'accept',
    tx_ref: 'sig-abc',
    chain_id: 'solana:devnet',
    chain_ns: 'solana',
    ...over,
  }
}

test('records the attempt and enqueues verify-tx with the canonical dedup key', async () => {
  const { deps, inserts, calls } = makeDeps()
  const r = await recordTxAttempt(deps, input())

  assert.deepStrictEqual(r, { recorded: true, enqueued: true })
  assert.deepStrictEqual(inserts[0], {
    user_id: 'u-1',
    escrow_id: 'e-1',
    action: 'accept',
    tx_ref: 'sig-abc',
  })
  assert.strictEqual(calls[0].name, 'verify-tx')
  assert.strictEqual(calls[0].payload.expected_event, 'EscrowAccepted')
  assert.strictEqual(calls[0].payload.escrow_id, 'e-1')
  assert.strictEqual(calls[0].payload.source, 'client-hint')
  assert.strictEqual(
    calls[0].job_id,
    dedupKey({ chain_ns: 'solana', tx_ref: 'sig-abc', event: 'EscrowAccepted' }),
  )
})

test('action → expected_event mapping covers settlement vocabulary', async () => {
  const { deps, calls } = makeDeps()
  await recordTxAttempt(deps, input({ action: 'claim_stalled', tx_ref: 's1' }))
  await recordTxAttempt(deps, input({ action: 'reclaim_abandoned', tx_ref: 's2' }))
  await recordTxAttempt(deps, input({ action: 'refund_expired', tx_ref: 's3' }))
  assert.deepStrictEqual(
    calls.map((c) => c.payload.expected_event),
    ['PaymentClaimed', 'EscrowAbandoned', 'EscrowExpired'],
  )
})

test('duplicate tx_ref → recorded:false but still enqueued (idempotent replay)', async () => {
  const { deps, calls } = makeDeps({ duplicate: true })
  const r = await recordTxAttempt(deps, input())
  assert.deepStrictEqual(r, { recorded: false, enqueued: true })
  assert.strictEqual(calls.length, 1)
})

test('queue down → recorded:true, enqueued:false, warning logged, no throw', async () => {
  const { deps, warns } = makeDeps({ queueDown: true })
  const r = await recordTxAttempt(deps, input())
  assert.deepStrictEqual(r, { recorded: true, enqueued: false })
  assert.strictEqual(warns.length, 1)
  assert.match(warns[0], /reconciliation/)
})

test('null escrow_id omits the hint from the verify-tx payload', async () => {
  const { deps, calls } = makeDeps()
  await recordTxAttempt(deps, input({ escrow_id: null }))
  assert.strictEqual('escrow_id' in calls[0].payload, false)
})
