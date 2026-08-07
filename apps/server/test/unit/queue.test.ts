/**
 * Queue plugin — Stage 0 surface. BullMQ wiring lands with #33.
 * Tests pin the typed surface and assert stub bodies fail loud.
 */

// getConfig() runs at plugin registration since #33 — stub required env
// before the app under test boots (same pattern as cloudinary.test.ts).
process.env.DATABASE_URL ??= 'postgres://localhost/test'
process.env.JWT_SECRET ??= 'test-secret'
process.env.CLOUDINARY_CLOUD_NAME ??= 'test-cloud'
process.env.CLOUDINARY_API_KEY ??= 'test-key'
process.env.CLOUDINARY_API_SECRET ??= 'test-secret-cl'
process.env.SOLANA_RPC_URL ??= 'http://127.0.0.1:8899'
process.env.SOLANA_TREASURY_ADDRESS ??= '4Nd1mYvK4Pm1x2HCmzCx5GQDV9KbpMK128bxgL5dVDU1'
process.env.SOLANA_PROGRAM_ID ??= '7H6AAoghUCPAVA1WTEwpSmkiRfPHWrgFidZQPzbXzkes'
process.env.API_BASE_URL ??= 'https://api.tenda.test'
delete process.env.REDIS_URL // pin the 501 stub path regardless of dev env


import { test } from 'node:test'
import * as assert from 'node:assert'
import fastify from 'fastify'
import { AppError } from '@server/lib/errors'
import queuePlugin, {
  toJobOptions,
  type BulkJob,
  type JobName,
  type JobPayload,
  type QueueService,
} from '@server/plugins/queue'

async function build(): Promise<ReturnType<typeof fastify>> {
  const app = fastify()
  await app.register(queuePlugin)
  return app
}

async function expectStubThrows(
  fn: () => Promise<unknown>,
  match: RegExp,
): Promise<AppError> {
  try {
    await fn()
  } catch (err) {
    if (!(err instanceof AppError)) throw err
    assert.strictEqual(err.statusCode, 501)
    assert.match(err.message, match)
    return err
  }
  assert.fail('expected enqueue stub to throw')
}

test('queue plugin: decorates fastify.queue with QueueService shape', async () => {
  const app = await build()
  assert.strictEqual(typeof app.queue, 'object')
  assert.strictEqual(typeof app.queue.enqueue, 'function')
  await app.close()
})

test('queue.enqueue: stub throws 501 INTERNAL_ERROR (notifications)', async () => {
  const app = await build()
  const err = await expectStubThrows(
    () => app.queue.enqueue('notifications', { user_id: 'u-1', title: 't', body: 'b' }),
    /notifications.*REDIS_URL not configured/,
  )
  assert.strictEqual(err.code, 'INTERNAL_ERROR')
  await app.close()
})

test('queue.enqueue: stub error mentions the job name (expire-escrows)', async () => {
  const app = await build()
  await expectStubThrows(
    () => app.queue.enqueue('expire-escrows', { tick_id: '1' }),
    /expire-escrows/,
  )
  await app.close()
})

test('queue.enqueue: stub fires regardless of opts', async () => {
  const app = await build()
  await expectStubThrows(
    () =>
      app.queue.enqueue(
        'reconcile',
        { from_iso: '2026-01-01T00:00:00Z', to_iso: '2026-01-02T00:00:00Z' },
        { job_id: 'fixed-id', delay_ms: 1000 },
      ),
    /reconcile/,
  )
  await app.close()
})

// ---------- type-surface regression --------------------------------------

test('JobName covers all 4 Stage 0 queues', () => {
  const names: ReadonlyArray<JobName> = ['notifications', 'expire-escrows', 'verify-tx', 'reconcile']
  assert.strictEqual(new Set(names).size, 4)
})

test('JobPayload shapes are statically distinct (compile-time check)', () => {
  const noti: JobPayload['notifications'] = { id: 'n-1', user_id: 'u-1', title: 'a', body: 'b', persist: true }
  const exp: JobPayload['expire-escrows'] = { tick_id: '1' }
  const ver: JobPayload['verify-tx'] = {
    chain_id: 'solana:devnet',
    tx_ref: 'sig',
    expected_event: 'EscrowCreated',
    source: 'client-hint',
  }
  const rec: JobPayload['reconcile'] = {
    from_iso: '2026-01-01T00:00:00Z',
    to_iso: '2026-01-02T00:00:00Z',
  }
  assert.strictEqual(noti.user_id, 'u-1')
  assert.strictEqual(exp.tick_id, '1')
  assert.strictEqual(ver.tx_ref, 'sig')
  // Window fields are optional on the payload (repeatables carry static
  // payloads) — narrow before comparing.
  assert.ok(rec.from_iso !== undefined && rec.to_iso !== undefined && rec.from_iso < rec.to_iso)
})

test('QueueService.enqueue: signature is generic over JobName (compile-time check)', () => {
  const fn: QueueService['enqueue'] = async () => ({ job_id: 'x' })
  assert.strictEqual(typeof fn, 'function')
})

// ---------- the bulk surface ----------------------------------------------

test('queue plugin: decorates enqueueMany alongside enqueue', async () => {
  const app = await build()
  assert.strictEqual(typeof app.queue.enqueueMany, 'function')
  await app.close()
})

test('queue.enqueueMany: stub throws 501 and names the method, not just the queue', async () => {
  const app = await build()
  const err = await expectStubThrows(
    () =>
      app.queue.enqueueMany('notifications', [
        { payload: { id: 'n-1', user_id: 'u-1', title: 't', body: 'b', persist: true } },
      ]),
    /enqueueMany\('notifications'\).*REDIS_URL not configured/,
  )
  // Naming the method matters for the same reason naming the queue does: the
  // two producer paths fail for the same reason but from different call sites,
  // and an operator reading the log should not have to guess which one ran.
  assert.strictEqual(err.code, 'INTERNAL_ERROR')
  await app.close()
})

// ---------- EnqueueOptions → BullMQ JobsOptions -----------------------------
//
// The mapping both producer paths share. It is on the live (Redis-backed) path
// and therefore unreachable from CI's suite, so it is tested directly: a field
// silently dropped here is honoured by whichever path was checked by hand and
// lost by the other, and `remove_on_complete` losing that coin-toss leaves a
// `send-otp` plaintext code sitting in completed-job history.

test('toJobOptions: renames every field to its BullMQ spelling', () => {
  assert.deepStrictEqual(
    toJobOptions({ job_id: 'k', delay_ms: 1500, attempts: 3, remove_on_complete: true }),
    { jobId: 'k', delay: 1500, attempts: 3, removeOnComplete: true },
  )
})

test('toJobOptions: an absent field is OMITTED, not set to undefined', () => {
  // Not cosmetic: BullMQ merges these over the queue's defaultJobOptions, so an
  // explicit `attempts: undefined` would erase DEFAULT_JOB_OPTIONS.attempts and
  // silently drop the retry budget to BullMQ's own default of 1.
  assert.deepStrictEqual(toJobOptions(undefined), {})
  assert.deepStrictEqual(toJobOptions({}), {})
  const only = toJobOptions({ job_id: 'k' })
  assert.deepStrictEqual(only, { jobId: 'k' })
  assert.deepStrictEqual(Object.keys(only), ['jobId'], 'no undefined-valued keys')
})

test('toJobOptions: falsy-but-present values survive', () => {
  // `delay_ms: 0` and `remove_on_complete: false` are meaningful, and a
  // truthiness check instead of an `!== undefined` one would drop both.
  assert.deepStrictEqual(toJobOptions({ delay_ms: 0, attempts: 0, remove_on_complete: false }), {
    delay: 0,
    attempts: 0,
    removeOnComplete: false,
  })
})

test('queue.enqueueMany: a per-job jobId is expressible (compile-time check)', () => {
  // BullMQ's addBulk takes per-job opts, which is what lets the dedup key stay
  // per job. One set shared across the batch would collapse it to a single job.
  const jobs: BulkJob<'notifications'>[] = [
    {
      payload: { id: 'n-1', user_id: 'u-1', title: 't', body: 'b', persist: true },
      opts: { job_id: 'k1', attempts: 2 },
    },
    { payload: { id: 'n-2', user_id: 'u-2', title: 't', body: 'b', persist: true } },
  ]
  assert.strictEqual(jobs[0].opts?.job_id, 'k1')
  assert.strictEqual(jobs[1].opts, undefined)
})
