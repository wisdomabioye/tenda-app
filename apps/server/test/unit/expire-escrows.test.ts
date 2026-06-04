/**
 * jobs/expire-escrows — windowed nudge handler.
 *
 * Idempotency model under test: bounded lookback window + deterministic
 * notification job_id. An unbounded scan would re-notify on every tick
 * once BullMQ prunes the completed notification job.
 */

import { test } from 'node:test'
import * as assert from 'node:assert'
import {
  EXPIRE_BATCH_LIMIT,
  EXPIRE_LOOKBACK_MS,
  expireNoticeJobId,
  handleExpireEscrows,
  type ExpireEscrowsDeps,
  type ExpiredOpenEscrow,
} from '@server/jobs/expire-escrows'
import type { JobPayload } from '@server/plugins/queue'

const NOW = new Date('2026-06-04T12:00:00Z')

interface EnqueueCall {
  name: string
  payload: JobPayload['notifications']
  job_id?: string
}

function makeDeps(rows: ExpiredOpenEscrow[]): {
  deps: ExpireEscrowsDeps
  calls: EnqueueCall[]
  warns: string[]
  queried: { since: Date; until: Date; limit: number }[]
} {
  const calls: EnqueueCall[] = []
  const warns: string[] = []
  const queried: { since: Date; until: Date; limit: number }[] = []
  const deps: ExpireEscrowsDeps = {
    store: {
      async findNewlyExpiredOpen(since, until, limit) {
        queried.push({ since, until, limit })
        return rows
      },
    },
    queue: {
      async enqueue(name, payload, opts) {
        // Handler only ever enqueues notifications; narrow for assertions.
        calls.push({
          name,
          payload: payload as JobPayload['notifications'],
          job_id: opts?.job_id,
        })
        return { job_id: opts?.job_id ?? 'generated' }
      },
    },
    log: {
      info() {},
      warn(_obj, msg) {
        warns.push(msg)
      },
    },
    now: () => NOW,
  }
  return { deps, calls, warns, queried }
}

function row(over: Partial<ExpiredOpenEscrow> = {}): ExpiredOpenEscrow {
  return { id: 'e-1', kind: 'gig', creator_id: 'u-1', ...over }
}

const TICK: JobPayload['expire-escrows'] = { tick_id: 't-1' }

test('queries the bounded lookback window ending at now', async () => {
  const { deps, queried } = makeDeps([])
  await handleExpireEscrows(deps, TICK)
  assert.strictEqual(queried.length, 1)
  assert.strictEqual(queried[0].until.getTime(), NOW.getTime())
  assert.strictEqual(queried[0].since.getTime(), NOW.getTime() - EXPIRE_LOOKBACK_MS)
  assert.strictEqual(queried[0].limit, EXPIRE_BATCH_LIMIT)
})

test('enqueues one creator nudge per expired escrow with deterministic job_id', async () => {
  const rows = [row(), row({ id: 'e-2', kind: 'exchange', creator_id: 'u-2' })]
  const { deps, calls } = makeDeps(rows)
  const result = await handleExpireEscrows(deps, TICK)

  assert.deepStrictEqual(result, { scanned: 2, enqueued: 2 })
  assert.strictEqual(calls.length, 2)
  assert.strictEqual(calls[0].name, 'notifications')
  assert.strictEqual(calls[0].payload.user_id, 'u-1')
  assert.strictEqual(calls[0].job_id, expireNoticeJobId('e-1'))
  assert.strictEqual(calls[0].payload.data?.escrow_id, 'e-1')
  assert.strictEqual(calls[0].payload.data?.reason, 'expired')
  // Kind-specific copy.
  assert.match(calls[0].payload.title, /gig/i)
  assert.match(calls[1].payload.title, /exchange/i)
})

test('empty window → no enqueues, no warning', async () => {
  const { deps, calls, warns } = makeDeps([])
  const result = await handleExpireEscrows(deps, TICK)
  assert.deepStrictEqual(result, { scanned: 0, enqueued: 0 })
  assert.strictEqual(calls.length, 0)
  assert.strictEqual(warns.length, 0)
})

test('full batch → overflow warning (no silent cap)', async () => {
  const rows = Array.from({ length: EXPIRE_BATCH_LIMIT }, (_, i) =>
    row({ id: `e-${i}`, creator_id: `u-${i}` }),
  )
  const { deps, warns } = makeDeps(rows)
  const result = await handleExpireEscrows(deps, TICK)
  assert.strictEqual(result.enqueued, EXPIRE_BATCH_LIMIT)
  assert.strictEqual(warns.length, 1)
  assert.match(warns[0], /batch limit/)
})

test('expireNoticeJobId is stable per escrow (dedup key)', () => {
  assert.strictEqual(expireNoticeJobId('abc'), expireNoticeJobId('abc'))
  assert.notStrictEqual(expireNoticeJobId('abc'), expireNoticeJobId('def'))
})
