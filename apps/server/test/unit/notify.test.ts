/**
 * lib/notify.ts — the notification WRITE contract. Three things are pinned
 * here because nothing else pins them:
 *
 *  1. `stableNotificationId` must return a WELL-FORMED UUID. `notifications.id`
 *     is a postgres `uuid` column, so a readable key like `alert.<id>.<user>`
 *     fails at INSERT time inside the delivery worker — i.e. on every retry,
 *     forever, with no user-visible signal. A shape regression here is silent
 *     in dev and total in production.
 *  2. The `id` guard in `enqueueNotification` moves that failure to the
 *     producer, where a test or a dev hits it immediately.
 *  3. The `*PushData` builders are the single server-side declaration of the
 *     deep-link contract the mobile resolver reads. Nine call sites used to
 *     hand-write these bags, so a key rename (`escrowId` → `escrow_id`) broke
 *     routing with nothing failing.
 */

import { test } from 'node:test'
import * as assert from 'node:assert'
import { NOTIFICATION_SCREEN } from '@tenda/shared'
import { isUuidLike } from '@server/lib/uuid'
import {
  stableNotificationId,
  enqueueNotification,
  escrowPushData,
  disputePushData,
  chatPushData,
  fiatIntentPushData,
  toNotificationWire,
} from '@server/lib/notify'
import type { JobName, JobPayload, EnqueueOptions, QueueService } from '@server/plugins/queue'

// ---------- helpers ----------------------------------------------------------

type NotifJob = JobPayload['notifications']

interface Captured {
  name: JobName
  payload: NotifJob
  opts?: EnqueueOptions
}

/** Minimal queue double — `enqueueNotification` only needs `enqueue`. */
function captureQueue(): Pick<QueueService, 'enqueue'> & { calls: Captured[] } {
  const calls: Captured[] = []
  return {
    calls,
    async enqueue(name, payload, opts) {
      calls.push({ name, payload: payload as NotifJob, opts })
      return { job_id: 'test-job' }
    },
  }
}

const UUID_A = '550e8400-e29b-41d4-a716-446655440000'

// ---------- stableNotificationId ---------------------------------------------

test('stableNotificationId: same parts produce the same id (idempotency premise)', () => {
  const a = stableNotificationId('dispute-alert', UUID_A, 'admin-inbox')
  const b = stableNotificationId('dispute-alert', UUID_A, 'admin-inbox')
  assert.strictEqual(a, b)
})

test('stableNotificationId: different parts produce different ids', () => {
  const a = stableNotificationId('dispute-alert', UUID_A, 'admin-inbox')
  const b = stableNotificationId('dispute-alert', UUID_A, 'email')
  assert.notStrictEqual(a, b, 'per-channel ids must not collide, or one channel silences the other')
})

// The reason the separator is NUL and not a space/dash: with a joinable
// separator these two argument lists hash the same string, so two DIFFERENT
// notices would share an id and the second would be dropped by
// onConflictDoNothing.
test('stableNotificationId: part boundaries are unambiguous (no join collision)', () => {
  assert.notStrictEqual(stableNotificationId('a', 'bc'), stableNotificationId('ab', 'c'))
})

test('stableNotificationId: output is a postgres-acceptable UUID', () => {
  const id = stableNotificationId('dispute-alert', UUID_A, 'slack')
  assert.ok(isUuidLike(id), `expected UUID shape, got ${id}`)
})

test('stableNotificationId: stamps RFC 9562 version 8 and the correct variant', () => {
  // Version nibble = first char of group 3; variant = first char of group 4
  // must be one of 8/9/a/b. Postgres accepts any hex, but a wrong variant makes
  // the id a lie about how it was derived.
  for (const parts of [['x'], ['a', 'b'], ['dispute-alert', UUID_A, 'email']]) {
    const groups = stableNotificationId(...parts).split('-')
    assert.strictEqual(groups[2][0], '8', 'version nibble')
    assert.match(groups[3][0], /[89ab]/, 'variant nibble')
  }
})

test('stableNotificationId: accepts a single part and an empty part list', () => {
  assert.ok(isUuidLike(stableNotificationId('solo')))
  assert.ok(isUuidLike(stableNotificationId()))
})

// ---------- enqueueNotification ----------------------------------------------

test('enqueueNotification: defaults to a random id and persists', async () => {
  const q = captureQueue()
  await enqueueNotification(q, { user_id: 'u1', title: 'T', body: 'B' })

  assert.strictEqual(q.calls.length, 1)
  const { name, payload } = q.calls[0]
  assert.strictEqual(name, 'notifications')
  assert.strictEqual(payload.user_id, 'u1')
  assert.strictEqual(payload.persist, true, 'persist defaults to true')
  assert.ok(isUuidLike(payload.id))
})

test('enqueueNotification: two default enqueues get DIFFERENT ids', async () => {
  const q = captureQueue()
  await enqueueNotification(q, { user_id: 'u1', title: 'T', body: 'B' })
  await enqueueNotification(q, { user_id: 'u1', title: 'T', body: 'B' })
  assert.notStrictEqual(q.calls[0].payload.id, q.calls[1].payload.id)
})

// The whole point of the new field: a producer that can be re-run for the same
// logical notice pins the id, so the delivery worker's onConflictDoNothing
// collapses the re-run instead of writing a second row + second badge.
test('enqueueNotification: a supplied id is used verbatim', async () => {
  const q = captureQueue()
  const id = stableNotificationId('dispute-alert', UUID_A, 'admin-inbox')
  await enqueueNotification(q, { user_id: 'u1', title: 'T', body: 'B', id })
  assert.strictEqual(q.calls[0].payload.id, id)
})

test('enqueueNotification: rejects a non-UUID id at the producer', async () => {
  const q = captureQueue()
  await assert.rejects(
    () =>
      enqueueNotification(q, {
        user_id: 'u1',
        title: 'T',
        body: 'B',
        id: 'dispute-alert.abc.admin-inbox',
      }),
    /must be a UUID/,
  )
  assert.strictEqual(q.calls.length, 0, 'the poison job never reaches the queue')
})

test('enqueueNotification: persist:false is preserved (chat stays out of the centre)', async () => {
  const q = captureQueue()
  await enqueueNotification(q, { user_id: 'u1', title: 'T', body: 'B', persist: false })
  assert.strictEqual(q.calls[0].payload.persist, false)
})

test('enqueueNotification: omits `data` entirely when the caller gives none', async () => {
  const q = captureQueue()
  await enqueueNotification(q, { user_id: 'u1', title: 'T', body: 'B' })
  assert.ok(!('data' in q.calls[0].payload), 'absent, not an empty object')
})

test('enqueueNotification: forwards queue options (job_id dedup, delay)', async () => {
  const q = captureQueue()
  await enqueueNotification(q, { user_id: 'u1', title: 'T', body: 'B' }, { job_id: 'k', delay_ms: 5 })
  assert.deepStrictEqual(q.calls[0].opts, { job_id: 'k', delay_ms: 5 })
})

// ---------- push-data builders ------------------------------------------------

test('escrowPushData: gig and exchange differ only by kind', () => {
  assert.deepStrictEqual(escrowPushData('e1', 'gig'), {
    screen: NOTIFICATION_SCREEN.escrow,
    escrowId: 'e1',
    kind: 'gig',
  })
  assert.strictEqual(escrowPushData('e1', 'exchange').kind, 'exchange')
})

test('disputePushData: carries BOTH ids — mobile routes by escrow, admin by dispute', () => {
  assert.deepStrictEqual(disputePushData('e1', 'd1'), {
    screen: NOTIFICATION_SCREEN.dispute,
    escrowId: 'e1',
    disputeId: 'd1',
  })
})

// An escrow can be `disputed` on-chain with no off-chain `disputes` row yet.
// Omitting the key is the honest answer; inventing one would deep-link the
// dashboard to a 404.
test('disputePushData: omits disputeId when there is no dispute row', () => {
  const data = disputePushData('e1', null)
  assert.deepStrictEqual(data, { screen: NOTIFICATION_SCREEN.dispute, escrowId: 'e1' })
  assert.ok(!('disputeId' in data))
})

test('chatPushData: userId is the SENDER, not the recipient', () => {
  assert.deepStrictEqual(chatPushData('c1', 'sender-1'), {
    screen: NOTIFICATION_SCREEN.chat,
    conversationId: 'c1',
    userId: 'sender-1',
  })
})

test('fiatIntentPushData: deep-links the intent', () => {
  assert.deepStrictEqual(fiatIntentPushData('i1'), {
    screen: NOTIFICATION_SCREEN.fiatIntent,
    intentId: 'i1',
  })
})

// Drift guard: the rule is ONE builder per screen. A screen added to the shared
// vocabulary with no builder means a producer will hand-write the bag again —
// exactly the drift this module exists to stop.
test('every NOTIFICATION_SCREEN member has a builder that emits it', () => {
  const emitted = new Set(
    [
      escrowPushData('e', 'gig'),
      disputePushData('e', 'd'),
      chatPushData('c', 'u'),
      fiatIntentPushData('i'),
    ].map((d) => d.screen),
  )
  assert.deepStrictEqual(
    [...emitted].sort(),
    Object.values(NOTIFICATION_SCREEN).slice().sort(),
  )
})

test('every builder emits a non-empty string for every key', () => {
  for (const data of [
    escrowPushData('e', 'gig'),
    disputePushData('e', 'd'),
    disputePushData('e', null),
    chatPushData('c', 'u'),
    fiatIntentPushData('i'),
  ]) {
    for (const [k, v] of Object.entries(data)) {
      assert.strictEqual(typeof v, 'string', `${k} must be a string (jsonb<Record<string,string>>)`)
      assert.ok(v.length > 0, `${k} must not be empty`)
    }
  }
})

// ---------- toNotificationWire ------------------------------------------------

test('toNotificationWire: nulls survive as null, dates become ISO strings', () => {
  const created = new Date('2026-08-03T10:00:00.000Z')
  const wire = toNotificationWire({
    id: UUID_A,
    user_id: 'u1',
    title: 'T',
    body: 'B',
    data: null,
    read_at: null,
    created_at: created,
  })
  assert.deepStrictEqual(wire, {
    id: UUID_A,
    title: 'T',
    body: 'B',
    data: null,
    read_at: null,
    created_at: '2026-08-03T10:00:00.000Z',
  })
})

test('toNotificationWire: a read notification carries its read_at', () => {
  const wire = toNotificationWire({
    id: UUID_A,
    user_id: 'u1',
    title: 'T',
    body: 'B',
    data: escrowPushData('e1', 'gig'),
    read_at: new Date('2026-08-03T11:00:00.000Z'),
    created_at: new Date('2026-08-03T10:00:00.000Z'),
  })
  assert.strictEqual(wire.read_at, '2026-08-03T11:00:00.000Z')
  assert.deepStrictEqual(wire.data, { screen: 'escrow', escrowId: 'e1', kind: 'gig' })
})
