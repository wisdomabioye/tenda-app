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
import { eq } from 'drizzle-orm'
import type { FastifyInstance } from 'fastify'
import { device_tokens, gig_subscriptions } from '@tenda/shared/db/schema'
import { buildVerifyTxDeps, buildProcessors, removeTokens } from '@server/workers/processors'
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
function evt(wire: EscrowEvent, escrow_id: string, tx_ref = 'sig-tx-1') {
  return { internal_event: INTERNAL_EVENT_BY_WIRE[wire], wire_event: wire, escrow_id, tx_ref }
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
  assert.deepStrictEqual(cap.enqueued[0].payload.data, { screen: 'escrow', escrowId: e.id })
})

test('approved notifies the counterparty only', { skip }, async () => {
  const app = getApp()
  const creator = await createUser(app)
  const worker = await createUser(app)
  const e = await createEscrow(app, { creator_id: creator.row.id, counterparty_id: worker.row.id })

  await buildVerifyTxDeps(app).republish(evt('EscrowApproved', e.id))
  assert.deepStrictEqual(notifUserIds(), [worker.row.id])
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
  await buildProcessors(app).notifications({ user_id: u.row.id, title: 't', body: 'b' })
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
  await buildProcessors(app).notifications({ user_id: u.row.id, title: 't', body: 'b' })

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
    await buildProcessors(app).notifications({ user_id: u.row.id, title: 't', body: 'b', data: { k: 'v' } })
  } finally {
    globalThis.fetch = realFetch
  }

  const rows = await app.db.select().from(device_tokens).where(eq(device_tokens.user_id, u.row.id))
  assert.deepStrictEqual(
    rows.map((r) => r.token),
    ['ExponentPushToken[live]'],
  )
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
  const names: JobName[] = [
    'verify-tx',
    'expire-escrows',
    'reconcile',
    'reconcile-fiat',
    'expire-fiat-quotes',
    'notifications',
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
