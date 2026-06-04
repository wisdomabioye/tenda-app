/**
 * chains/solana/listener-polling — cursor-driven tick: fresh-slot
 * filtering, oldest-first enqueue, cursor advance, and the abort-without-
 * advance contract when the queue dies mid-batch.
 */

import { test } from 'node:test'
import * as assert from 'node:assert'
import { pollTick, type PollTickDeps } from '@server/chains/solana/listener-polling'
import { fakeSolanaRpc } from '../helpers/solana'

function makeDeps(opts: {
  cursor?: number
  signatures: Array<{ signature: string; slot: number }>
  enqueueFailsAt?: string
}): {
  deps: PollTickDeps
  calls: { enqueued: string[]; cursors: number[] }
} {
  const calls = { enqueued: [] as string[], cursors: [] as number[] }
  let cursor = opts.cursor ?? 0
  const rpc = fakeSolanaRpc()
  rpc.stageSignatures(opts.signatures)
  const deps: PollTickDeps = {
    rpc,
    chain_id: 'solana:devnet',
    cursors: {
      async getCursor() {
        return cursor
      },
      async setCursor(_chain, slot) {
        cursor = slot
        calls.cursors.push(slot)
      },
    },
    queue: {
      async enqueue(_name, payload) {
        const p = payload as { tx_ref: string }
        if (p.tx_ref === opts.enqueueFailsAt) throw new Error('redis down')
        calls.enqueued.push(p.tx_ref)
        return { job_id: 'x' }
      },
    },
    log: { info() {}, warn() {} },
  }
  return { deps, calls }
}

test('enqueues only signatures beyond the cursor, oldest first, then advances', async () => {
  const { deps, calls } = makeDeps({
    cursor: 100,
    signatures: [
      { signature: 'new-2', slot: 120 }, // newest first, as the RPC returns
      { signature: 'new-1', slot: 110 },
      { signature: 'old', slot: 90 },
    ],
  })
  const r = await pollTick(deps)
  assert.deepStrictEqual(calls.enqueued, ['new-1', 'new-2'])
  assert.strictEqual(r.enqueued, 2)
  assert.deepStrictEqual(calls.cursors, [120])
})

test('no fresh signatures → no enqueue, cursor untouched', async () => {
  const { deps, calls } = makeDeps({
    cursor: 200,
    signatures: [{ signature: 'old', slot: 150 }],
  })
  const r = await pollTick(deps)
  assert.strictEqual(r.enqueued, 0)
  assert.strictEqual(calls.cursors.length, 0)
  assert.strictEqual(r.cursor, 200)
})

test('queue failure mid-batch aborts WITHOUT advancing past the gap', async () => {
  const { deps, calls } = makeDeps({
    cursor: 100,
    signatures: [
      { signature: 'c', slot: 130 },
      { signature: 'b', slot: 120 },
      { signature: 'a', slot: 110 },
    ],
    enqueueFailsAt: 'b',
  })
  const r = await pollTick(deps)
  // 'a' (slot 110) enqueued; 'b' (120) failed → cursor parks at 119 so the
  // next tick retries from 'b' onward.
  assert.deepStrictEqual(calls.enqueued, ['a'])
  assert.deepStrictEqual(calls.cursors, [119])
  assert.strictEqual(r.cursor, 119)
})

test('fresh start (cursor 0) sweeps the whole batch', async () => {
  const { deps, calls } = makeDeps({
    signatures: [
      { signature: 's2', slot: 2 },
      { signature: 's1', slot: 1 },
    ],
  })
  await pollTick(deps)
  assert.deepStrictEqual(calls.enqueued, ['s1', 's2'])
})
