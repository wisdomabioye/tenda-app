/**
 * plugins/queue wiring — URL → BullMQ connection options, queue naming.
 * The producer/consumer round-trip itself is covered by the Redis-gated
 * integration test (test/integration/bullmq.test.ts).
 */

import { test } from 'node:test'
import * as assert from 'node:assert'
import { queueConnectionOptions, queueName, QUEUE_PREFIX } from '@server/plugins/queue'

test('queueConnectionOptions: host/port defaults, password, db path', () => {
  assert.deepStrictEqual(queueConnectionOptions('redis://localhost:6379'), {
    host: 'localhost',
    port: 6379,
    maxRetriesPerRequest: null,
  })
  // Port defaults when omitted.
  assert.strictEqual(queueConnectionOptions('redis://redis.internal').port, 6379)
  // Password + db index (redis://:pass@host:port/2).
  const full = queueConnectionOptions('redis://:s3cret@10.0.0.5:6380/2')
  assert.deepStrictEqual(full, {
    host: '10.0.0.5',
    port: 6380,
    password: 's3cret',
    db: 2,
    maxRetriesPerRequest: null,
  })
})

test('queueName: stable tenant prefix, no colons (BullMQ forbids them)', () => {
  assert.strictEqual(queueName('verify-tx'), `${QUEUE_PREFIX}.verify-tx`)
  assert.strictEqual(queueName('notifications'), `${QUEUE_PREFIX}.notifications`)
  assert.ok(!queueName('verify-tx').includes(':'))
})
