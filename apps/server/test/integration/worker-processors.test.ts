/**
 * #98 gap-fill — workers/processors.ts: the verify-tx republish fan-out
 * (WS frame + push notice + new-gig subscriber fan-out), notification
 * delivery (token resolve-at-delivery + dead-token prune), and the deps /
 * processor builders.
 *
 * Reached through the real seams — `buildVerifyTxDeps(app).republish(...)`
 * drives `fanOutEscrowEvent`, `buildProcessors(app).notifications(...)`
 * drives `deliverNotification` — so nothing in the source is exported just
 * for the test. `queue.enqueue` and `wsBroadcast.broadcast` are captured by
 * typed fakes; the one Expo-prune case stubs `fetch` (otherwise fully
 * offline). Gated on TEST_DATABASE_URL.
 */
import { test, beforeEach } from 'node:test'
import assert from 'node:assert'
import { randomUUID } from 'node:crypto'
import { eq } from 'drizzle-orm'
import type { FastifyInstance } from 'fastify'
import { device_tokens, gig_subscriptions, notifications } from '@tenda/shared/db/schema'
import { category_price_stats } from '@tenda/shared/db/schema/moderation'
import { NOTIFICATION_BODY_MAX } from '@tenda/shared'
import { buildVerifyTxDeps, buildProcessors, removeTokens } from '@server/workers/processors'
import type { DevicePlatform } from '@server/lib/push-services'
import type { PushService } from '@server/chains/types'
import { channelName } from '@server/lib/ws'
import { INTERNAL_EVENT_BY_WIRE } from '@server/lib/escrow-events'
import type { EscrowEvent } from '@server/chains/types'
import type { JobName, JobPayload } from '@server/plugins/queue'
import {
  TEST_DB_CONFIGURED,
  useTestApp,
  createUser,
  createEscrow,
  attachGigDetails,
} from '../helpers/test-app'

const skip = !TEST_DB_CONFIGURED
const getApp = useTestApp()

// ---------- side-effect capture -------------------------------------------------

interface Capture {
  enqueued: Array<{ name: JobName; payload: JobPayload['notifications'] }>
  broadcasts: Array<{ channel: string; payload: Record<string, unknown> }>
}

function installCapture(app: FastifyInstance): Capture {
  const cap: Capture = { enqueued: [], broadcasts: [] }
  app.queue.enqueue = async (name, payload) => {
    // Every worker fan-out enqueues a 'notifications' job (the only producer here).
    cap.enqueued.push({ name, payload: payload as JobPayload['notifications'] })
    return { job_id: 'test-job' }
  }
  app.wsBroadcast.broadcast = (channel, payload) => {
    cap.broadcasts.push({ channel, payload })
    return 0
  }
  return cap
}

let cap: Capture
beforeEach(() => {
  if (skip) return
  cap = installCapture(getApp())
})

/** Build a republish event from a wire name (internal derived, never hardcoded). */
function evt(
  wire: EscrowEvent,
  escrow_id: string,
  tx_ref = 'sig-tx-1',
  counterparty_id: string | null = null,
) {
  return {
    internal_event: INTERNAL_EVENT_BY_WIRE[wire],
    wire_event: wire,
    escrow_id,
    tx_ref,
    counterparty_id,
  }
}

/**
 * A delivery-job payload with a stamped id (as `enqueueNotification` would).
 * Defaults `persist:false` so the token-delivery tests stay pure push tests;
 * the persistence tests opt in with `persist:true`.
 */
function notifJob(
  overrides: Partial<JobPayload['notifications']> & { user_id: string },
): JobPayload['notifications'] {
  return { id: randomUUID(), title: 't', body: 'b', persist: false, ...overrides }
}

/** All notification frames broadcast on a given user's channel. */
function userFrames(userId: string): Array<{ channel: string; payload: Record<string, unknown> }> {
  return cap.broadcasts.filter((b) => b.channel === channelName({ kind: 'user', id: userId }))
}

function notifUserIds(): string[] {
  return cap.enqueued.filter((e) => e.name === 'notifications').map((e) => e.payload.user_id)
}

// ---------- fanOutEscrowEvent: WS frame ----------------------------------------

test('republish broadcasts the exact escrow_event WS frame on the escrow channel', { skip }, async () => {
  const app = getApp()
  const creator = await createUser(app)
  const e = await createEscrow(app, { creator_id: creator.row.id })

  await buildVerifyTxDeps(app).republish(evt('EscrowAccepted', e.id, 'sig-abc'))

  assert.strictEqual(cap.broadcasts.length, 1)
  assert.strictEqual(cap.broadcasts[0].channel, channelName({ kind: 'escrow', id: e.id }))
  assert.deepStrictEqual(cap.broadcasts[0].payload, {
    type: 'escrow_event',
    escrow_id: e.id,
    event: 'EscrowAccepted',
    tx_ref: 'sig-abc',
  })
})

// ---------- fanOutEscrowEvent: push recipient resolution ------------------------

test('accepted notifies the creator only', { skip }, async () => {
  const app = getApp()
  const creator = await createUser(app)
  const worker = await createUser(app)
  const e = await createEscrow(app, { creator_id: creator.row.id, counterparty_id: worker.row.id })

  await buildVerifyTxDeps(app).republish(evt('EscrowAccepted', e.id))
  assert.deepStrictEqual(notifUserIds(), [creator.row.id])
  assert.strictEqual(cap.enqueued[0].payload.title, 'Gig accepted')
  // `kind` is part of the deep-link contract (useNotificationDeepLink routes
  // gig vs exchange on it), so the push data carries it — here a default gig.
  assert.deepStrictEqual(cap.enqueued[0].payload.data, { screen: 'escrow', escrowId: e.id, kind: 'gig' })
  // enqueueNotification stamps a stable id and defaults persist=true, so the
  // notice both persists into the centre and dedupes across retries.
  assert.strictEqual(typeof cap.enqueued[0].payload.id, 'string')
  assert.strictEqual(cap.enqueued[0].payload.persist, true)
})

test('approved notifies the counterparty only', { skip }, async () => {
  const app = getApp()
  const creator = await createUser(app)
  const worker = await createUser(app)
  const e = await createEscrow(app, { creator_id: creator.row.id, counterparty_id: worker.row.id })

  await buildVerifyTxDeps(app).republish(evt('EscrowApproved', e.id))
  assert.deepStrictEqual(notifUserIds(), [worker.row.id])
})

// ---------- approval mode ------------------------------------------------------

test('counterparty_assigned notifies the assigned WORKER, not the poster', { skip }, async () => {
  const app = getApp()
  const creator = await createUser(app)
  const worker = await createUser(app)
  const e = await createEscrow(app, { creator_id: creator.row.id, counterparty_id: worker.row.id })

  await buildVerifyTxDeps(app).republish(evt('CounterpartyAssigned', e.id))
  // The poster performed the transaction; the worker signed nothing, so this
  // push is the only way they learn the gig is theirs.
  assert.deepStrictEqual(notifUserIds(), [worker.row.id])
  assert.strictEqual(cap.enqueued[0].payload.title, 'You got the gig')
})

// THE regression this pair exists for: `unassign` clears counterparty_id, and
// the fan-out re-reads the escrow row AFTER the transition commits. Addressing
// the released worker from the row therefore reaches nobody — the applier has
// to carry them out. Delete the plumbing and this test fails while everything
// else stays green.
test('assignment_released reaches the worker the row no longer names', { skip }, async () => {
  const app = getApp()
  const creator = await createUser(app)
  const worker = await createUser(app)
  // Post-unassign state exactly as the applier leaves it: back to open, no
  // counterparty on the row.
  const e = await createEscrow(app, { creator_id: creator.row.id, counterparty_id: null })

  await buildVerifyTxDeps(app).republish(
    evt('AssignmentReleased', e.id, 'sig-tx-1', worker.row.id),
  )
  assert.deepStrictEqual(notifUserIds(), [worker.row.id])
  assert.strictEqual(cap.enqueued[0].payload.title, 'Assignment withdrawn')
})

test('assignment_released with no carried worker notifies nobody (never a crash)', { skip }, async () => {
  const app = getApp()
  const creator = await createUser(app)
  const e = await createEscrow(app, { creator_id: creator.row.id, counterparty_id: null })

  await buildVerifyTxDeps(app).republish(evt('AssignmentReleased', e.id))
  assert.deepStrictEqual(notifUserIds(), [])
})

test('dispute_raised notifies BOTH parties', { skip }, async () => {
  const app = getApp()
  const creator = await createUser(app)
  const worker = await createUser(app)
  const e = await createEscrow(app, { creator_id: creator.row.id, counterparty_id: worker.row.id })

  await buildVerifyTxDeps(app).republish(evt('DisputeRaised', e.id))
  assert.deepStrictEqual(new Set(notifUserIds()), new Set([creator.row.id, worker.row.id]))
})

test('a BOTH-recipient event with a null counterparty notifies only the creator (null skipped)', { skip }, async () => {
  const app = getApp()
  const creator = await createUser(app)
  const e = await createEscrow(app, { creator_id: creator.row.id, counterparty_id: null })

  await buildVerifyTxDeps(app).republish(evt('DisputeResolved', e.id))
  assert.deepStrictEqual(notifUserIds(), [creator.row.id])
})

test('an event with no notice (cancelled) broadcasts but enqueues nothing', { skip }, async () => {
  const app = getApp()
  const creator = await createUser(app)
  const e = await createEscrow(app, { creator_id: creator.row.id })

  await buildVerifyTxDeps(app).republish(evt('EscrowCancelled', e.id))
  assert.strictEqual(cap.broadcasts.length, 1) // WS still fires
  assert.strictEqual(cap.enqueued.length, 0)
})

test('a notice event whose escrow row is missing broadcasts but does not throw or enqueue', { skip }, async () => {
  const app = getApp()
  const missing = '00000000-0000-4000-8000-000000000000'
  await buildVerifyTxDeps(app).republish(evt('EscrowAccepted', missing))
  assert.strictEqual(cap.broadcasts.length, 1)
  assert.strictEqual(cap.enqueued.length, 0)
})

// ---------- fanOutNewGigToSubscribers (escrow.created) --------------------------

test('created fans out to matching city/wildcard subscribers, excluding the creator', { skip }, async () => {
  const app = getApp()
  const creator = await createUser(app)
  const subCity = await createUser(app)
  const subWild = await createUser(app)
  const subOtherCity = await createUser(app)
  const e = await createEscrow(app, { creator_id: creator.row.id, kind: 'gig' })
  await attachGigDetails(app, e.id, { city: 'Lagos', category: 'service' })

  await app.db.insert(gig_subscriptions).values([
    { user_id: subCity.row.id, city: 'Lagos', category: 'service' },
    { user_id: subWild.row.id, city: '*', category: '*' },
    { user_id: subOtherCity.row.id, city: 'Abuja', category: 'service' }, // no match
    { user_id: creator.row.id, city: '*', category: '*' }, // self — excluded
  ])

  await buildVerifyTxDeps(app).republish(evt('EscrowCreated', e.id))

  assert.deepStrictEqual(new Set(notifUserIds()), new Set([subCity.row.id, subWild.row.id]))
  assert.ok(cap.enqueued.every((x) => x.payload.title === 'New Gig Posted'))
})

test('a remote gig (null city) matches wildcard-city subscribers only', { skip }, async () => {
  const app = getApp()
  const creator = await createUser(app)
  const subWild = await createUser(app)
  const subCity = await createUser(app)
  const e = await createEscrow(app, { creator_id: creator.row.id, kind: 'gig' })
  await attachGigDetails(app, e.id, { city: null, category: 'service' })

  await app.db.insert(gig_subscriptions).values([
    { user_id: subWild.row.id, city: '*', category: 'service' },
    { user_id: subCity.row.id, city: 'Lagos', category: 'service' }, // city sub must NOT match a remote gig
  ])

  await buildVerifyTxDeps(app).republish(evt('EscrowCreated', e.id))
  assert.deepStrictEqual(notifUserIds(), [subWild.row.id])
  assert.match(String(cap.enqueued[0].payload.body), /Remote/)
})

test('one subscriber with two matching sub rows is notified exactly once (dedup)', { skip }, async () => {
  const app = getApp()
  const creator = await createUser(app)
  const sub = await createUser(app)
  const e = await createEscrow(app, { creator_id: creator.row.id, kind: 'gig' })
  await attachGigDetails(app, e.id, { city: 'Lagos', category: 'service' })

  await app.db.insert(gig_subscriptions).values([
    { user_id: sub.row.id, city: 'Lagos', category: 'service' },
    { user_id: sub.row.id, city: '*', category: '*' }, // same user, both match
  ])

  await buildVerifyTxDeps(app).republish(evt('EscrowCreated', e.id))
  assert.deepStrictEqual(notifUserIds(), [sub.row.id]) // once, not twice
})

test('created on an exchange escrow (no gig_details) fans out nothing', { skip }, async () => {
  const app = getApp()
  const creator = await createUser(app)
  const e = await createEscrow(app, { creator_id: creator.row.id, kind: 'exchange' })
  await app.db.insert(gig_subscriptions).values({ user_id: (await createUser(app)).row.id, city: '*', category: '*' })

  await buildVerifyTxDeps(app).republish(evt('EscrowCreated', e.id))
  assert.strictEqual(cap.broadcasts.length, 1) // WS still fires
  assert.strictEqual(cap.enqueued.length, 0)
})

// ---------- deliverNotification + removeTokens ----------------------------------

test('notifications: a user with no device tokens delivers nothing (no throw)', { skip }, async () => {
  const app = getApp()
  const u = await createUser(app)
  await buildProcessors(app).notifications(notifJob({ user_id: u.row.id }))
  // No tokens, no prune target — the row set is unchanged (empty).
  const rows = await app.db.select().from(device_tokens).where(eq(device_tokens.user_id, u.row.id))
  assert.strictEqual(rows.length, 0)
})

test('notifications: an unconfigured platform counts failed but never prunes the token', { skip }, async () => {
  const app = getApp()
  const u = await createUser(app)
  // FCM is not configured in the harness → routePush degrades it as failed,
  // NOT as a dead token, so the row must survive.
  await app.db.insert(device_tokens).values({ user_id: u.row.id, token: 'fcm-tok', platform: 'fcm' })
  await buildProcessors(app).notifications(notifJob({ user_id: u.row.id }))

  const rows = await app.db.select().from(device_tokens).where(eq(device_tokens.user_id, u.row.id))
  assert.strictEqual(rows.length, 1)
})

test('notifications: an Expo DeviceNotRegistered token is pruned, the live one kept', { skip }, async () => {
  const app = getApp()
  const u = await createUser(app)
  await app.db.insert(device_tokens).values([
    { user_id: u.row.id, token: 'ExponentPushToken[live]', platform: 'expo' },
    { user_id: u.row.id, token: 'ExponentPushToken[gone]', platform: 'expo' },
  ])

  const realFetch = globalThis.fetch
  globalThis.fetch = (async (_url: string, init?: { body?: string }) => {
    // Expo preserves token order; report DeviceNotRegistered for the dead one.
    const body = JSON.parse(String(init?.body)) as { to: string[] }
    const data = body.to.map((t) =>
      t.includes('gone')
        ? { status: 'error', details: { error: 'DeviceNotRegistered' } }
        : { status: 'ok' },
    )
    return { ok: true, status: 200, json: async () => ({ data }) } as Response
  }) as typeof fetch

  try {
    await buildProcessors(app).notifications(notifJob({ user_id: u.row.id, data: { k: 'v' } }))
  } finally {
    globalThis.fetch = realFetch
  }

  const rows = await app.db.select().from(device_tokens).where(eq(device_tokens.user_id, u.row.id))
  assert.deepStrictEqual(
    rows.map((r) => r.token),
    ['ExponentPushToken[live]'],
  )
})

test('every notification delivery reuses the ONE services instance from buildProcessors (token cache survives)', { skip }, async () => {
  const app = getApp()
  const u = await createUser(app)
  await app.db.insert(device_tokens).values({ user_id: u.row.id, token: 'fcm-a', platform: 'fcm' })

  // A single injected services object with a counting fcm transport. Both
  // deliveries must route through THIS instance — proving deliverNotification
  // uses the services built once by buildProcessors, not a per-delivery
  // rebuild (which would discard the FCM OAuth / APNS JWT token cache).
  let sends = 0
  const services: Partial<Record<DevicePlatform, PushService>> = {
    fcm: {
      async send() {
        sends += 1
        return { ok: 1, failed: 0, invalid_tokens: [] }
      },
    },
  }

  const procs = buildProcessors(app, services)
  await procs.notifications(notifJob({ user_id: u.row.id, title: 't1', body: 'b1' }))
  await procs.notifications(notifJob({ user_id: u.row.id, title: 't2', body: 'b2' }))

  // If deliverNotification rebuilt services internally, the injected fcm
  // service would be ignored (expo-only default) → sends would stay 0.
  assert.strictEqual(sends, 2)
})

test('removeTokens deletes the listed tokens; an empty list is a no-op', { skip }, async () => {
  const app = getApp()
  const u = await createUser(app)
  await app.db.insert(device_tokens).values([
    { user_id: u.row.id, token: 'keep-1', platform: 'expo' },
    { user_id: u.row.id, token: 'drop-1', platform: 'expo' },
  ])

  await removeTokens(app, []) // no-op — both survive
  assert.strictEqual(
    (await app.db.select().from(device_tokens).where(eq(device_tokens.user_id, u.row.id))).length,
    2,
  )

  await removeTokens(app, ['drop-1'])
  const rows = await app.db.select().from(device_tokens).where(eq(device_tokens.user_id, u.row.id))
  assert.deepStrictEqual(
    rows.map((r) => r.token),
    ['keep-1'],
  )
})

// ---------- deliverNotification: persistence + WS badge -------------------------

test('persist=true writes one row and broadcasts a NotificationFrame on the user channel', { skip }, async () => {
  const app = getApp()
  const u = await createUser(app)
  const job = notifJob({
    user_id: u.row.id,
    title: 'Gig accepted',
    body: 'work underway',
    data: { screen: 'escrow', escrowId: 'e1', kind: 'gig' },
    persist: true,
  })
  await buildProcessors(app).notifications(job)

  const rows = await app.db.select().from(notifications).where(eq(notifications.user_id, u.row.id))
  assert.strictEqual(rows.length, 1)
  assert.strictEqual(rows[0].id, job.id)
  assert.strictEqual(rows[0].title, 'Gig accepted')
  assert.strictEqual(rows[0].read_at, null)
  assert.deepStrictEqual(rows[0].data, { screen: 'escrow', escrowId: 'e1', kind: 'gig' })

  const frames = userFrames(u.row.id)
  assert.strictEqual(frames.length, 1)
  assert.strictEqual(frames[0].payload.type, 'notification')
  const wire = (frames[0].payload as { notification: { id: string; read_at: string | null } }).notification
  assert.strictEqual(wire.id, job.id)
  assert.strictEqual(wire.read_at, null)
})

test('persist=false pushes but writes NO row and no notification frame', { skip }, async () => {
  const app = getApp()
  const u = await createUser(app)
  await buildProcessors(app).notifications(notifJob({ user_id: u.row.id, persist: false }))
  const rows = await app.db.select().from(notifications).where(eq(notifications.user_id, u.row.id))
  assert.strictEqual(rows.length, 0)
  assert.strictEqual(userFrames(u.row.id).length, 0)
})

test('a persisted notification is written even when the user has NO device token', { skip }, async () => {
  const app = getApp()
  const u = await createUser(app)
  // No device_tokens row → persist must run BEFORE the no-token early return.
  await buildProcessors(app).notifications(notifJob({ user_id: u.row.id, persist: true }))
  assert.strictEqual(
    (await app.db.select().from(notifications).where(eq(notifications.user_id, u.row.id))).length,
    1,
  )
})

test('delivering the SAME id twice is idempotent — one row, no double badge', { skip }, async () => {
  const app = getApp()
  const u = await createUser(app)
  const job = notifJob({ user_id: u.row.id, persist: true })
  await buildProcessors(app).notifications(job)
  await buildProcessors(app).notifications(job) // BullMQ retry — identical job.data

  assert.strictEqual(
    (await app.db.select().from(notifications).where(eq(notifications.user_id, u.row.id))).length,
    1,
  )
  // The retry must NOT re-broadcast, else the unread badge double-counts.
  assert.strictEqual(userFrames(u.row.id).length, 1)
})

test('an over-long body is clamped to the column cap (no numeric/length overflow 5xx)', { skip }, async () => {
  const app = getApp()
  const u = await createUser(app)
  const longBody = 'x'.repeat(NOTIFICATION_BODY_MAX + 50)
  await buildProcessors(app).notifications(notifJob({ user_id: u.row.id, body: longBody, persist: true }))
  const rows = await app.db.select().from(notifications).where(eq(notifications.user_id, u.row.id))
  assert.strictEqual(rows.length, 1)
  assert.strictEqual(rows[0].body.length, NOTIFICATION_BODY_MAX)
})

// ---------- builders ------------------------------------------------------------

test('buildVerifyTxDeps wires the live chains registry + a republish fn', { skip }, async () => {
  const app = getApp()
  const deps = buildVerifyTxDeps(app)
  assert.strictEqual(deps.chains, app.chains)
  assert.strictEqual(typeof deps.republish, 'function')
  assert.ok(deps.store !== undefined && deps.eventStore !== undefined)
})

test('buildProcessors exposes a handler fn for every job name', { skip }, async () => {
  const app = getApp()
  const procs = buildProcessors(app)
  // NB: this list once drifted (send-otp and update-price-stats were missing
  // while they existed as JobNames) — keep it the FULL JobName set; the
  // compiler enforces buildProcessors covers JobName, this asserts the
  // handlers are real functions at runtime.
  const names: JobName[] = [
    'verify-tx',
    'expire-escrows',
    'reconcile',
    'reconcile-fiat',
    'expire-fiat-quotes',
    'notifications',
    'send-otp',
    'update-price-stats',
  ]
  for (const n of names) assert.strictEqual(typeof procs[n], 'function', `${n} must be a function`)
})

test('the expire-escrows + reconcile processors run their handlers (no-op on an empty DB)', { skip }, async () => {
  const app = getApp()
  const procs = buildProcessors(app)
  // Nothing to expire/reconcile → both resolve cleanly and enqueue nothing.
  await procs['expire-escrows']({ tick_id: 'tick-1' })
  await procs['reconcile']({})
  assert.strictEqual(cap.enqueued.length, 0)
})

// ---------- update-price-stats processor ----------------------------------------

test('update-price-stats rolls completed gigs into category_price_stats percentiles', { skip }, async () => {
  const app = getApp()
  const creator = await createUser(app)
  // Unique category per run — the rollup scans the whole DB and the harness
  // does not truncate between tests; filtering by category isolates this test.
  const category = `svc-${randomUUID().slice(0, 8)}`
  for (const amount_raw of ['100', '300', '200']) {
    const e = await createEscrow(app, {
      creator_id: creator.row.id,
      kind: 'gig',
      status: 'completed',
      amount_raw,
    })
    await attachGigDetails(app, e.id, { category, country: 'NG' })
  }

  await buildProcessors(app)['update-price-stats']({ tick_id: 'tick-ps' })

  const rows = await app.db
    .select()
    .from(category_price_stats)
    .where(eq(category_price_stats.category, category))
  assert.strictEqual(rows.length, 1)
  assert.strictEqual(rows[0].sample_size, 3)
  assert.strictEqual(rows[0].p10_amount_raw, '100')
  assert.strictEqual(rows[0].p50_amount_raw, '200')
  assert.strictEqual(rows[0].p90_amount_raw, '300')
})

test('update-price-stats ignores non-completed gigs and exchange escrows', { skip }, async () => {
  const app = getApp()
  const creator = await createUser(app)
  const category = `svc-${randomUUID().slice(0, 8)}`
  const open = await createEscrow(app, {
    creator_id: creator.row.id,
    kind: 'gig',
    status: 'open',
    amount_raw: '999',
  })
  await attachGigDetails(app, open.id, { category, country: 'NG' })
  // Exchange escrows carry no gig_details — excluded by the join even when completed.
  await createEscrow(app, {
    creator_id: creator.row.id,
    kind: 'exchange',
    status: 'completed',
    amount_raw: '5',
  })

  await buildProcessors(app)['update-price-stats']({ tick_id: 'tick-ps-neg' })

  const rows = await app.db
    .select()
    .from(category_price_stats)
    .where(eq(category_price_stats.category, category))
  assert.strictEqual(rows.length, 0)
})
