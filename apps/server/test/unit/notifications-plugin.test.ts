/**
 * Stage 7 — the producer contract (plugins/notifications.ts). These listeners
 * decide WHAT reaches the in-app centre: chat (`message.sent`) must push but
 * NOT persist (persist:false — it has its own read surface), while review and
 * fiat notices persist (persist:true) with a deep-linkable `data` bag. Delivery
 * (persist true/false → row/no-row) is covered by worker-processors.test.ts;
 * this pins the flags + data the producers actually pass.
 *
 * Pure unit: a minimal Fastify app with stub db/queue plugins registers the
 * REAL notifications plugin, so no DB/Redis is needed — just the appEvents wiring.
 */
import { test, before, after, beforeEach } from 'node:test'
import assert from 'node:assert'
import Fastify, { type FastifyInstance } from 'fastify'
import fp from 'fastify-plugin'
import notificationsPlugin from '@server/plugins/notifications'
import { appEvents } from '@server/lib/events'
import type { AppDatabase } from '@server/plugins/db'
import type { JobName, JobPayload } from '@server/plugins/queue'

type NotifJob = JobPayload['notifications']

let app: FastifyInstance
let jobs: NotifJob[] = []

before(async () => {
  app = Fastify({ logger: false })
  // Stub the two decorators the plugin declares as dependencies. The plugin
  // never touches the db in these paths, so an empty object stands in.
  await app.register(
    fp(
      async (f) => {
        f.decorate('db', {} as AppDatabase)
      },
      { name: 'db' },
    ),
  )
  await app.register(
    fp(
      async (f) => {
        f.decorate('queue', {
          async enqueue(name: JobName, payload: JobPayload[JobName]) {
            if (name === 'notifications') jobs.push(payload as NotifJob)
            return { job_id: 'test' }
          },
        })
      },
      { name: 'queue' },
    ),
  )
  await app.register(notificationsPlugin)
  await app.ready()
})

after(async () => {
  await app.close()
})

beforeEach(() => {
  jobs = []
})

/** Listeners are async; emit is sync — let the microtasks settle. */
const flush = () => new Promise((r) => setImmediate(r))

test('message.sent pushes but does NOT persist (chat stays out of the centre)', async () => {
  appEvents.emit('message.sent', {
    recipientId: 'u-recipient',
    senderId: 'u-sender',
    conversationId: 'c1',
    preview: 'hey there',
  })
  await flush()

  assert.strictEqual(jobs.length, 1)
  assert.strictEqual(jobs[0].user_id, 'u-recipient')
  assert.strictEqual(jobs[0].persist, false)
  assert.deepStrictEqual(jobs[0].data, { screen: 'chat', conversationId: 'c1', userId: 'u-sender' })
})

test('review.submitted persists and deep-links a gig (title set → kind gig)', async () => {
  appEvents.emit('review.submitted', {
    revieweeId: 'u-reviewee',
    reviewerId: 'u-reviewer',
    escrowId: 'e1',
    title: 'Build a logo',
    score: 5,
  })
  await flush()

  assert.strictEqual(jobs.length, 1)
  assert.strictEqual(jobs[0].user_id, 'u-reviewee')
  assert.strictEqual(jobs[0].persist, true)
  assert.deepStrictEqual(jobs[0].data, { screen: 'escrow', escrowId: 'e1', kind: 'gig' })
})

test('review.submitted on an exchange (null title) deep-links kind exchange', async () => {
  appEvents.emit('review.submitted', {
    revieweeId: 'u-reviewee',
    reviewerId: 'u-reviewer',
    escrowId: 'e2',
    title: null,
    score: 4,
  })
  await flush()

  assert.strictEqual(jobs.length, 1)
  assert.strictEqual(jobs[0].data?.kind, 'exchange')
})

test('fiat.settled persists and deep-links the intent', async () => {
  appEvents.emit('fiat.settled', {
    user_id: 'u-fiat',
    intent_id: 'i1',
    direction: 'offramp',
    fiat_currency: 'NGN',
    fiat_amount: '15000.00',
    asset: 'USDC_SOL',
    asset_amount_raw: '10000000',
  })
  await flush()

  assert.strictEqual(jobs.length, 1)
  assert.strictEqual(jobs[0].user_id, 'u-fiat')
  assert.strictEqual(jobs[0].persist, true)
  assert.deepStrictEqual(jobs[0].data, { screen: 'fiat-intent', intentId: 'i1' })
})

test('fiat.failed persists the failure reason for the intent', async () => {
  appEvents.emit('fiat.failed', {
    user_id: 'u-fiat',
    intent_id: 'i2',
    direction: 'onramp',
    fiat_currency: 'KES',
    fiat_amount: '1300.00',
    asset: 'USDC_SOL',
    asset_amount_raw: '10000000',
    reason: 'Card declined',
  })
  await flush()

  assert.strictEqual(jobs.length, 1)
  assert.strictEqual(jobs[0].persist, true)
  assert.strictEqual(jobs[0].body, 'Card declined')
  assert.deepStrictEqual(jobs[0].data, { screen: 'fiat-intent', intentId: 'i2' })
})
