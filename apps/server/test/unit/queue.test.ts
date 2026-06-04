/**
 * Queue plugin — Stage 0 surface. BullMQ wiring lands with #33.
 * Tests pin the typed surface and assert stub bodies fail loud.
 */

import { test } from 'node:test'
import * as assert from 'node:assert'
import fastify from 'fastify'
import { AppError } from '@server/lib/errors'
import queuePlugin, {
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
    /notifications.*BullMQ not provisioned/,
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
  const noti: JobPayload['notifications'] = { user_id: 'u-1', title: 'a', body: 'b' }
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
  assert.ok(rec.from_iso < rec.to_iso)
})

test('QueueService.enqueue: signature is generic over JobName (compile-time check)', () => {
  const fn: QueueService['enqueue'] = async () => ({ job_id: 'x' })
  assert.strictEqual(typeof fn, 'function')
})
