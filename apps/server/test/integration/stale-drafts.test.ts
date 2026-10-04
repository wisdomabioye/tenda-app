/**
 * discardStaleDrafts — what the retention sweep may and may not delete.
 *
 * Real rows against a real database, because the guards ARE the SQL: still a
 * draft, created before the cutoff, no create awaiting confirmation. The
 * dangerous failure is not leaving a stale draft behind; it is deleting a row
 * whose create is already on its way to the chain.
 */
import { test } from 'node:test'
import assert from 'node:assert'
import { randomUUID } from 'node:crypto'
import { eq, inArray } from 'drizzle-orm'
import { escrows, gig_details, tx_attempts } from '@tenda/shared/db/schema'
import type { EscrowStatus } from '@tenda/shared'
import { discardStaleDrafts } from '@server/features/escrows/creation/staleDrafts'
import { TEST_DB_CONFIGURED, attachGigDetails, createEscrow, createUser, resetDb, useTestApp } from '../helpers/test-app'

const skip = !TEST_DB_CONFIGURED
const getApp = useTestApp()

const DAY = 24 * 3_600_000
const CUTOFF = new Date('2026-10-03T00:00:00Z')
const before = (ms: number): Date => new Date(CUTOFF.getTime() - ms)

async function exists(id: string): Promise<boolean> {
  const rows = await getApp().db.select({ id: escrows.id }).from(escrows).where(eq(escrows.id, id))
  return rows.length === 1
}

async function draft(created_at: Date, over: { status?: EscrowStatus; kind?: 'gig' | 'exchange' } = {}) {
  const app = getApp()
  const creator = await createUser(app)
  const status = over.status ?? 'draft'
  const row = await createEscrow(app, {
    creator_id: creator.row.id,
    status,
    created_at,
    ...(over.kind !== undefined ? { kind: over.kind } : {}),
    ...(status === 'draft' ? {} : { escrow_ref: `ref-${randomUUID()}` }),
  })
  return row.id
}

test('a draft older than the cutoff goes; a fresher one stays', { skip }, async () => {
  await resetDb(getApp())
  const old = await draft(before(DAY))
  const fresh = await draft(new Date(CUTOFF.getTime() + DAY))
  assert.strictEqual(await discardStaleDrafts(getApp().db, { older_than: CUTOFF, limit: 100 }), 1)
  assert.strictEqual(await exists(old), false)
  assert.strictEqual(await exists(fresh), true)
})

test('the cutoff is strict: a draft created exactly at it is kept', { skip }, async () => {
  await resetDb(getApp())
  const atCutoff = await draft(CUTOFF)
  assert.strictEqual(await discardStaleDrafts(getApp().db, { older_than: CUTOFF, limit: 100 }), 0)
  assert.strictEqual(await exists(atCutoff), true)
})

test('only DRAFTS go: every older status is left alone, however old', { skip }, async () => {
  await resetDb(getApp())
  const kept: string[] = []
  for (const status of ['open', 'accepted', 'submitted', 'completed', 'cancelled', 'disputed'] as const) {
    kept.push(await draft(before(30 * DAY), { status }))
  }
  assert.strictEqual(await discardStaleDrafts(getApp().db, { older_than: CUTOFF, limit: 100 }), 0)
  const remaining = await getApp().db.select({ id: escrows.id }).from(escrows).where(inArray(escrows.id, kept))
  assert.strictEqual(remaining.length, kept.length)
})

test('a draft whose create is awaiting confirmation is never discarded, whatever its age', { skip }, async () => {
  const app = getApp()
  await resetDb(app)
  const inFlight = await draft(before(30 * DAY))
  const owner = await app.db.select({ creator_id: escrows.creator_id }).from(escrows).where(eq(escrows.id, inFlight))
  await app.db.insert(tx_attempts).values({
    user_id: owner[0].creator_id,
    escrow_id: inFlight,
    action: 'create',
    tx_ref: `create-${randomUUID()}`,
  })
  assert.strictEqual(await discardStaleDrafts(app.db, { older_than: CUTOFF, limit: 100 }), 0)
  assert.strictEqual(await exists(inFlight), true, 'a draft with a create in flight was erased')
})

test('a SETTLED create attempt does not pin the draft: a failed one leaves it discardable', { skip }, async () => {
  const app = getApp()
  await resetDb(app)
  const failed = await draft(before(30 * DAY))
  const owner = await app.db.select({ creator_id: escrows.creator_id }).from(escrows).where(eq(escrows.id, failed))
  await app.db.insert(tx_attempts).values({
    user_id: owner[0].creator_id,
    escrow_id: failed,
    action: 'create',
    tx_ref: `create-${randomUUID()}`,
    failed_at: new Date(),
  })
  assert.strictEqual(await discardStaleDrafts(app.db, { older_than: CUTOFF, limit: 100 }), 1)
  assert.strictEqual(await exists(failed), false)
})

test('a batch takes the OLDEST first and respects the limit', { skip }, async () => {
  await resetDb(getApp())
  const oldest = await draft(before(10 * DAY))
  const middle = await draft(before(5 * DAY))
  const newest = await draft(before(DAY))
  assert.strictEqual(await discardStaleDrafts(getApp().db, { older_than: CUTOFF, limit: 2 }), 2)
  assert.strictEqual(await exists(oldest), false)
  assert.strictEqual(await exists(middle), false)
  assert.strictEqual(await exists(newest), true, 'the limit was ignored or the order was newest-first')
})

test('rows the sweep must keep cannot starve the ones it may discard: the batch is chosen FROM the eligible set', { skip }, async () => {
  // The DELETE re-asserts every guard, so a selection that wrongly included an
  // old open escrow or an in-flight draft would delete nothing it should not —
  // and, with a small batch, would spend the whole batch on rows that cannot go,
  // leaving the stale drafts behind them undiscarded forever.
  const app = getApp()
  await resetDb(app)
  const openEscrow = await draft(before(30 * DAY), { status: 'open' })
  const inFlight = await draft(before(29 * DAY))
  const owner = await app.db.select({ creator_id: escrows.creator_id }).from(escrows).where(eq(escrows.id, inFlight))
  await app.db.insert(tx_attempts).values({
    user_id: owner[0].creator_id,
    escrow_id: inFlight,
    action: 'create',
    tx_ref: `create-${randomUUID()}`,
  })
  const stale = await draft(before(DAY))

  assert.strictEqual(await discardStaleDrafts(app.db, { older_than: CUTOFF, limit: 1 }), 1)
  assert.strictEqual(await exists(stale), false, 'a stale draft was starved by rows that cannot be discarded')
  assert.strictEqual(await exists(openEscrow), true)
  assert.strictEqual(await exists(inFlight), true)
})

test('exchange drafts go too, and a gig draft takes its listing row with it', { skip }, async () => {
  const app = getApp()
  await resetDb(app)
  const gig = await draft(before(DAY))
  await attachGigDetails(app, gig)
  const exchange = await draft(before(DAY), { kind: 'exchange' })
  assert.strictEqual(await discardStaleDrafts(app.db, { older_than: CUTOFF, limit: 100 }), 2)
  assert.strictEqual(await exists(gig), false)
  assert.strictEqual(await exists(exchange), false)
  const listing = await app.db.select({ id: gig_details.escrow_id }).from(gig_details).where(eq(gig_details.escrow_id, gig))
  assert.deepStrictEqual(listing, [], 'the satellite row outlived its escrow')
})

test('nothing stale: nothing happens', { skip }, async () => {
  await resetDb(getApp())
  assert.strictEqual(await discardStaleDrafts(getApp().db, { older_than: CUTOFF, limit: 100 }), 0)
})
