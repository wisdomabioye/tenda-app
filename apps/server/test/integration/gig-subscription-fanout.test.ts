/**
 * New-gig fan-out to gig_subscriptions (workers/escrow-fanout/subscribers.ts).
 *
 * Deliberately an integration test: the matching is SQL — a wildcard sentinel
 * OR'd against the gig's city and category — so a fake store would assert the
 * query we wrote rather than the rows postgres returns. It also had NO test at
 * all before this file, while quietly deciding who hears about every new gig.
 *
 * Gated on TEST_DATABASE_URL.
 */
import { test, beforeEach } from 'node:test'
import assert from 'node:assert'
import { gig_subscriptions } from '@tenda/shared/db/schema'
import { fanOutEscrowEvent, type EscrowFanoutEvent } from '@server/workers/escrow-fanout'
import { installCapture, type SideEffectCapture } from '../helpers/side-effects'
import {
  TEST_DB_CONFIGURED,
  useTestApp,
  createUser,
  createEscrow,
  attachGigDetails,
  attachExchangeDetails,
  type GigDetailsOverrides,
} from '../helpers/test-app'

const skip = !TEST_DB_CONFIGURED
const getApp = useTestApp()

type App = ReturnType<typeof getApp>

let capture: SideEffectCapture

beforeEach(() => {
  if (skip) return
  capture = installCapture(getApp())
})

async function subscribe(
  app: App,
  user_id: string,
  city: string,
  category: string,
): Promise<void> {
  await app.db.insert(gig_subscriptions).values({ user_id, city, category })
}

/** A gig escrow that has just gone live, plus the created republish event. */
async function createdGig(
  app: App,
  creator_id: string,
  details: GigDetailsOverrides = {},
) {
  const escrow = await createEscrow(app, {
    creator_id,
    status: 'open',
    escrow_ref: `ref-${Math.random().toString(36).slice(2)}`,
  })
  await attachGigDetails(app, escrow.id, details)
  return escrow
}

function createdEvent(escrow_id: string): EscrowFanoutEvent {
  return {
    internal_event: 'escrow.created',
    escrow_id,
    wire_event: 'EscrowCreated',
    tx_ref: `sig-${Math.random().toString(36).slice(2)}`,
    counterparty_id: null,
    passed_applicant_ids: [],
    revived_applicant_ids: [],
  }
}

// ── who matches ────────────────────────────────────────────────────────────

test('notifies exact city+category subscribers and wildcard subscribers', { skip }, async () => {
  const app = getApp()
  const poster = await createUser(app)
  const exact = await createUser(app)
  const anyCity = await createUser(app)
  const anyBoth = await createUser(app)

  await subscribe(app, exact.row.id, 'Lagos', 'service')
  await subscribe(app, anyCity.row.id, '*', 'service')
  await subscribe(app, anyBoth.row.id, '*', '*')

  const escrow = await createdGig(app, poster.row.id, { city: 'Lagos', category: 'service' })
  await fanOutEscrowEvent(app, createdEvent(escrow.id))

  assert.deepStrictEqual(
    capture.notifiedUserIds().sort(),
    [exact.row.id, anyCity.row.id, anyBoth.row.id].sort(),
  )
})

test('does NOT notify a different city or a different category', { skip }, async () => {
  const app = getApp()
  const poster = await createUser(app)
  const otherCity = await createUser(app)
  const otherCategory = await createUser(app)

  await subscribe(app, otherCity.row.id, 'Abuja', 'service')
  await subscribe(app, otherCategory.row.id, 'Lagos', 'delivery')

  const escrow = await createdGig(app, poster.row.id, { city: 'Lagos', category: 'service' })
  await fanOutEscrowEvent(app, createdEvent(escrow.id))

  assert.deepStrictEqual(capture.notifiedUserIds(), [])
})

test('a remote gig (no city) reaches wildcard subscribers only', { skip }, async () => {
  // Nobody subscribed to "Lagos" asked to hear about work that is nowhere.
  const app = getApp()
  const poster = await createUser(app)
  const cityWatcher = await createUser(app)
  const anyCity = await createUser(app)

  await subscribe(app, cityWatcher.row.id, 'Lagos', 'service')
  await subscribe(app, anyCity.row.id, '*', 'service')

  const escrow = await createdGig(app, poster.row.id, { city: null, remote: true })
  await fanOutEscrowEvent(app, createdEvent(escrow.id))

  assert.deepStrictEqual(capture.notifiedUserIds(), [anyCity.row.id])
})

test('the poster is never notified about their own gig', { skip }, async () => {
  // They subscribe like anyone else; they just already know they posted it.
  const app = getApp()
  const poster = await createUser(app)
  await subscribe(app, poster.row.id, '*', '*')

  const escrow = await createdGig(app, poster.row.id, { city: 'Lagos', category: 'service' })
  await fanOutEscrowEvent(app, createdEvent(escrow.id))

  assert.deepStrictEqual(capture.notifiedUserIds(), [])
})

test('a user whose several subscriptions all match is notified once', { skip }, async () => {
  const app = getApp()
  const poster = await createUser(app)
  const eager = await createUser(app)
  // Three rows, all matching the same gig — the unique constraint is on
  // (user_id, city, category), so this is a state a user can really reach.
  await subscribe(app, eager.row.id, 'Lagos', 'service')
  await subscribe(app, eager.row.id, '*', 'service')
  await subscribe(app, eager.row.id, '*', '*')

  const escrow = await createdGig(app, poster.row.id, { city: 'Lagos', category: 'service' })
  await fanOutEscrowEvent(app, createdEvent(escrow.id))

  assert.deepStrictEqual(capture.notifiedUserIds(), [eager.row.id])
})

// ── what they receive ──────────────────────────────────────────────────────

test('the notice names the gig and its city, and deep-links to the gig', { skip }, async () => {
  const app = getApp()
  const poster = await createUser(app)
  const watcher = await createUser(app)
  await subscribe(app, watcher.row.id, '*', '*')

  const escrow = await createdGig(app, poster.row.id, {
    title: 'Paint the fence',
    city: 'Lagos',
    category: 'service',
  })
  await fanOutEscrowEvent(app, createdEvent(escrow.id))

  assert.strictEqual(capture.enqueued.length, 1)
  const [notice] = capture.notifications()
  assert.strictEqual(notice.title, 'New Gig Posted')
  assert.strictEqual(notice.body, '"Paint the fence" in Lagos')
  // kind rides along so the deep link resolves /gig/:id, not /exchange/:id.
  assert.deepStrictEqual(notice.data, {
    screen: 'escrow',
    escrowId: escrow.id,
    kind: 'gig',
  })
})

test('a remote gig reads as "Remote" rather than an empty place', { skip }, async () => {
  const app = getApp()
  const poster = await createUser(app)
  const watcher = await createUser(app)
  await subscribe(app, watcher.row.id, '*', '*')

  const escrow = await createdGig(app, poster.row.id, { title: 'Write copy', city: null, remote: true })
  await fanOutEscrowEvent(app, createdEvent(escrow.id))

  assert.strictEqual(capture.notifications()[0].body, '"Write copy" in Remote')
})

// ── what must stay silent ──────────────────────────────────────────────────

test('an exchange escrow fans out to nobody (it has no gig_details row)', { skip }, async () => {
  const app = getApp()
  const poster = await createUser(app)
  const watcher = await createUser(app)
  await subscribe(app, watcher.row.id, '*', '*')

  const escrow = await createEscrow(app, {
    creator_id: poster.row.id,
    kind: 'exchange',
    status: 'open',
    escrow_ref: `ref-${Math.random().toString(36).slice(2)}`,
  })
  await attachExchangeDetails(app, escrow.id)

  await fanOutEscrowEvent(app, createdEvent(escrow.id))

  assert.deepStrictEqual(capture.notifiedUserIds(), [])
})

test('created fans out to subscribers ONLY — no party notice rides along', { skip }, async () => {
  // The early return after the subscriber fan-out is what keeps a poster from
  // being told about the escrow they just signed for.
  const app = getApp()
  const poster = await createUser(app)
  const watcher = await createUser(app)
  await subscribe(app, watcher.row.id, '*', '*')

  const escrow = await createdGig(app, poster.row.id, { city: 'Lagos', category: 'service' })
  await fanOutEscrowEvent(app, createdEvent(escrow.id))

  assert.deepStrictEqual(capture.notifiedUserIds(), [watcher.row.id])
})
