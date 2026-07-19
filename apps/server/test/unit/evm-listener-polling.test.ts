/**
 * chains/evm/listener-polling — block-cursor tick: bounded backfill on first
 * run, chunked ranges with the per-tick cap, per-tx-hash dedup inside a range,
 * confirmation lag, cursor advance per completed range, and the
 * abort-without-advance contract when the queue dies mid-batch.
 */

import { test } from 'node:test'
import * as assert from 'node:assert'
import {
  evmPollTick,
  createEvmPollingListener,
  EVM_BACKFILL_BLOCKS,
  EVM_GETLOGS_MAX_RANGE,
  EVM_MAX_RANGES_PER_TICK,
  type EvmPollTickDeps,
} from '@server/chains/evm/listener-polling'
import type { EvmLogRef } from '@server/chains/evm/rpc'

const CONTRACT = '0x9d0193f7000000000000000000000000000000c3' as const
const CHAIN_ID = 'eip155:84532'

function ref(tx: string, block: bigint): EvmLogRef {
  return { tx_hash: `0x${tx.repeat(2).padEnd(64, '0')}` as `0x${string}`, block_number: block }
}

function makeDeps(opts: {
  cursor?: number
  head: bigint
  deploy_block?: number
  min_confirmations?: number
  /** Staged logs; served to every getLogRefs call unless perRange is set. */
  logs?: EvmLogRef[]
  /** Optional per-call responses, consumed in order (chunking tests). */
  perRange?: EvmLogRef[][]
  enqueueFailsAt?: string
}): {
  deps: EvmPollTickDeps
  calls: { enqueued: string[]; cursors: number[]; ranges: Array<[bigint, bigint]> }
} {
  const calls = {
    enqueued: [] as string[],
    cursors: [] as number[],
    ranges: [] as Array<[bigint, bigint]>,
  }
  let cursor = opts.cursor ?? 0
  let rangeIndex = 0
  const deps: EvmPollTickDeps = {
    rpc: {
      async getBlockNumber() {
        return opts.head
      },
      async getLogRefs(_contract, from, to) {
        calls.ranges.push([from, to])
        if (opts.perRange !== undefined) return opts.perRange[rangeIndex++] ?? []
        // Serve only the staged logs inside the queried window.
        return (opts.logs ?? []).filter((l) => l.block_number >= from && l.block_number <= to)
      },
    },
    chain_id: CHAIN_ID,
    escrow_contract: CONTRACT,
    ...(opts.deploy_block !== undefined ? { deploy_block: opts.deploy_block } : {}),
    min_confirmations: opts.min_confirmations ?? 5,
    cursors: {
      async getCursor() {
        return cursor
      },
      async setCursor(_chain, ordinal) {
        cursor = ordinal
        calls.cursors.push(ordinal)
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

test('scans (cursor, head − confirmations] and advances the cursor', async () => {
  const logA = ref('aa', 150n)
  const logB = ref('bb', 190n)
  const { deps, calls } = makeDeps({ cursor: 100, head: 205n, logs: [logA, logB] })

  const result = await evmPollTick(deps)

  assert.deepEqual(calls.ranges, [[101n, 200n]]) // head 205 − 5 confirmations
  assert.deepEqual(calls.enqueued, [logA.tx_hash, logB.tx_hash])
  assert.deepEqual(calls.cursors, [200])
  assert.deepEqual(result, { ranges: 1, logs: 2, enqueued: 2, cursor: 200 })
})

test('a multi-log transaction is enqueued exactly once', async () => {
  const sameTx = ref('cc', 150n)
  const { deps, calls } = makeDeps({ cursor: 100, head: 205n, logs: [sameTx, { ...sameTx }] })

  const result = await evmPollTick(deps)

  assert.deepEqual(calls.enqueued, [sameTx.tx_hash])
  assert.equal(result.logs, 2)
  assert.equal(result.enqueued, 1)
})

test('caught up: no getLogs call, no cursor write', async () => {
  const { deps, calls } = makeDeps({ cursor: 200, head: 205n })

  const result = await evmPollTick(deps)

  assert.deepEqual(calls.ranges, [])
  assert.deepEqual(calls.cursors, [])
  assert.deepEqual(result, { ranges: 0, logs: 0, enqueued: 0, cursor: 200 })
})

test('head within the confirmation lag of the cursor is a no-op (never scans unconfirmed blocks)', async () => {
  const { deps, calls } = makeDeps({ cursor: 200, head: 204n, min_confirmations: 5 })

  await evmPollTick(deps)

  assert.deepEqual(calls.ranges, [])
  assert.deepEqual(calls.cursors, [])
})

test('first run backfills a bounded window, never from genesis', async () => {
  const head = 500_000n
  const { deps, calls } = makeDeps({ cursor: 0, head, perRange: [[], [], [], [], []] })

  await evmPollTick(deps)

  const safeHead = head - 5n
  const expectedStart = safeHead - EVM_BACKFILL_BLOCKS + 1n
  assert.equal(calls.ranges[0][0], expectedStart)
  // Ranges are chunked and capped per tick.
  assert.equal(calls.ranges.length, EVM_MAX_RANGES_PER_TICK)
  for (const [from, to] of calls.ranges) {
    assert.ok(to - from + 1n <= EVM_GETLOGS_MAX_RANGE)
  }
  // Cursor advanced to the end of the last COMPLETED range, so the next tick
  // resumes exactly there.
  const lastTo = calls.ranges[calls.ranges.length - 1][1]
  assert.equal(BigInt(calls.cursors[calls.cursors.length - 1]), lastTo)
})

test('first run with a deploy block starts EXACTLY there, ignoring the recency window', async () => {
  const head = 500_000n
  // Deploy block far older than the 200k window — the window must not clip it.
  const deploy = 100_000
  const { deps, calls } = makeDeps({ cursor: 0, head, deploy_block: deploy, perRange: [[], [], [], [], []] })

  await evmPollTick(deps)

  assert.equal(calls.ranges[0][0], BigInt(deploy))
})

test('a deploy block still inside the unconfirmed zone is a no-op, not a crash', async () => {
  // Contract deployed 2 blocks ago on a 5-confirmation chain: nothing safe to
  // scan yet; the tick must wait rather than scan past safeHead.
  const { deps, calls } = makeDeps({ cursor: 0, head: 102n, deploy_block: 100, min_confirmations: 5 })

  const result = await evmPollTick(deps)

  assert.deepEqual(calls.ranges, [])
  assert.deepEqual(calls.cursors, [])
  assert.equal(result.enqueued, 0)
})

test('the deploy block is ignored once a cursor exists (restart resumes at cursor+1)', async () => {
  const { deps, calls } = makeDeps({ cursor: 300_000, head: 400_005n, deploy_block: 100_000 })

  await evmPollTick(deps)

  assert.equal(calls.ranges[0][0], 300_001n)
})

test('a fresh low-block chain backfills from block 1', async () => {
  const { deps, calls } = makeDeps({ cursor: 0, head: 105n, logs: [ref('dd', 50n)] })

  await evmPollTick(deps)

  assert.deepEqual(calls.ranges, [[1n, 100n]])
  assert.equal(calls.enqueued.length, 1)
})

test('the next tick resumes a partial backfill from the stored cursor', async () => {
  const head = 500_000n
  const first = makeDeps({ cursor: 0, head, perRange: [[], [], [], [], []] })
  const r1 = await evmPollTick(first.deps)

  const second = makeDeps({ cursor: r1.cursor, head, perRange: [[], [], [], [], []] })
  await evmPollTick(second.deps)

  assert.equal(second.calls.ranges[0][0], BigInt(r1.cursor) + 1n)
})

test('enqueue failure: cursor stops before the failed block, tick aborts', async () => {
  const ok = ref('aa', 150n)
  const bad = ref('bb', 160n)
  const after = ref('cc', 170n)
  const { deps, calls } = makeDeps({
    cursor: 100,
    head: 205n,
    logs: [ok, bad, after],
    enqueueFailsAt: bad.tx_hash,
  })

  const result = await evmPollTick(deps)

  assert.deepEqual(calls.enqueued, [ok.tx_hash])
  // Advanced only to the block before the failure; 'after' is never reached.
  assert.deepEqual(calls.cursors, [159])
  assert.equal(result.cursor, 159)
  assert.equal(result.enqueued, 1)
})

test('enqueue failure in the FIRST block never moves the cursor backwards', async () => {
  const bad = ref('bb', 101n)
  const { deps, calls } = makeDeps({ cursor: 100, head: 205n, logs: [bad], enqueueFailsAt: bad.tx_hash })

  const result = await evmPollTick(deps)

  assert.deepEqual(calls.cursors, []) // 100 → no write, next tick retries 101
  assert.equal(result.cursor, 100)
})

test('an RPC failure leaves the cursor untouched and surfaces to the runner', async () => {
  const { deps, calls } = makeDeps({ cursor: 100, head: 205n })
  deps.rpc = {
    async getBlockNumber() {
      return 205n
    },
    async getLogRefs() {
      throw new Error('rpc down')
    },
  }

  await assert.rejects(() => evmPollTick(deps), /rpc down/)
  assert.deepEqual(calls.cursors, [])
})

test('verify-tx jobs carry the polling source and the Any-event dedup id', async () => {
  const log = ref('ee', 150n)
  const { deps } = makeDeps({ cursor: 100, head: 205n, logs: [log] })
  const jobs: Array<{ payload: unknown; job_id: string | undefined }> = []
  deps.queue = {
    async enqueue(_name, payload, options) {
      jobs.push({ payload, job_id: options?.job_id })
      return { job_id: 'x' }
    },
  }

  await evmPollTick(deps)

  assert.deepEqual(jobs[0].payload, { chain_id: CHAIN_ID, tx_ref: log.tx_hash, source: 'polling' })
  assert.equal(jobs[0].job_id, `verify-tx.eip155.84532.${log.tx_hash}.Any`)
})

test('listener start/stop: ticks on the interval, never overlaps, stops cleanly', async () => {
  let ticks = 0
  // Object property (not a let) so TS's closure flow analysis accepts the
  // assignment made inside the first tick.
  const gate: { release?: () => void } = {}
  const { deps } = makeDeps({ cursor: 100, head: 205n })
  deps.rpc = {
    async getBlockNumber() {
      ticks += 1
      // First tick blocks until released, later intervals must skip it.
      if (ticks === 1) await new Promise<void>((resolve) => (gate.release = resolve))
      return 205n
    },
    async getLogRefs() {
      return []
    },
  }

  const listener = createEvmPollingListener({ ...deps, interval_ms: 5 })
  await listener.start()
  await new Promise((resolve) => setTimeout(resolve, 30))
  assert.equal(ticks, 1) // overlapping intervals skipped while tick 1 hangs
  gate.release?.()
  await new Promise((resolve) => setTimeout(resolve, 30))
  assert.ok(ticks >= 2) // resumed ticking once free
  await listener.stop()
  const at = ticks
  await new Promise((resolve) => setTimeout(resolve, 20))
  assert.equal(ticks, at) // no ticks after stop
})
