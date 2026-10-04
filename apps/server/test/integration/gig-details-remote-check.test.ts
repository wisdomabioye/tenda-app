/**
 * gig_details_remote_no_location — a remote gig names no country and no city.
 *
 * The validator already guarantees it for everything that arrives over HTTP; the
 * CHECK holds it for everything that does not (a second writer, a backfill, a
 * hand-run fix). So these run against a real database, and end with the case
 * that matters for not breaking anyone: what the validator DOES accept must
 * still be storable — a remote gig with coordinates, and a "remote" body that
 * carries a country, which the validator drops.
 */
import { test } from 'node:test'
import assert from 'node:assert'
import { eq } from 'drizzle-orm'
import { gig_details } from '@tenda/shared/db/schema'
import { validateGigDetails } from '@server/features/gigs/gig-details'
import { upsertGigDetails } from '@server/features/gigs/attachGigDetails'
import { TEST_DB_CONFIGURED, createEscrow, createUser, resetDb, useTestApp } from '../helpers/test-app'

const skip = !TEST_DB_CONFIGURED
const getApp = useTestApp()
const CONSTRAINT = 'gig_details_remote_no_location'

/** Walk the cause chain the way lib/errors/pg does: Drizzle wraps the driver's error. */
function violated(err: unknown): string | undefined {
  let current: unknown = err
  for (let depth = 0; depth < 5 && typeof current === 'object' && current !== null; depth += 1) {
    if ('code' in current && current.code === '23514' && 'constraint_name' in current) {
      return String(current.constraint_name)
    }
    current = 'cause' in current ? current.cause : undefined
  }
  return undefined
}

const rejectedBy = (name: string) => (err: unknown): boolean => violated(err) === name

async function listing(over: Partial<typeof gig_details.$inferInsert>) {
  const app = getApp()
  const creator = await createUser(app)
  const escrow = await createEscrow(app, { creator_id: creator.row.id, status: 'draft' })
  return { app, escrow, row: { escrow_id: escrow.id, title: 'A gig', category: 'service', ...over } }
}

test('a remote gig with a country is refused by the database', { skip }, async () => {
  await resetDb(getApp())
  const { app, row } = await listing({ remote: true, country: 'NG' })
  await assert.rejects(app.db.insert(gig_details).values(row), rejectedBy(CONSTRAINT))
})

test('a remote gig with a city is refused by the database', { skip }, async () => {
  await resetDb(getApp())
  const { app, row } = await listing({ remote: true, city: 'Lagos' })
  await assert.rejects(app.db.insert(gig_details).values(row), rejectedBy(CONSTRAINT))
})

test('a remote gig with neither is stored', { skip }, async () => {
  await resetDb(getApp())
  const { app, row } = await listing({ remote: true })
  await app.db.insert(gig_details).values(row)
  const [stored] = await app.db.select().from(gig_details).where(eq(gig_details.escrow_id, row.escrow_id))
  assert.strictEqual(stored.remote, true)
  assert.strictEqual(stored.country, null)
})

test('an on-site gig is stored with its location — and the rule does not DEMAND one', { skip }, async () => {
  await resetDb(getApp())
  const placed = await listing({ remote: false, country: 'NG', city: 'Lagos' })
  await placed.app.db.insert(gig_details).values(placed.row)
  // Requiring a location for an on-site gig is the validator's job; a CHECK
  // here would make a backfill or a draft-in-progress unwritable for no gain.
  const bare = await listing({ remote: false })
  await bare.app.db.insert(gig_details).values(bare.row)
})

test('flipping a located gig to remote without clearing its location is refused', { skip }, async () => {
  await resetDb(getApp())
  const { app, row } = await listing({ remote: false, country: 'NG', city: 'Lagos' })
  await app.db.insert(gig_details).values(row)
  await assert.rejects(
    app.db.update(gig_details).set({ remote: true }).where(eq(gig_details.escrow_id, row.escrow_id)),
    rejectedBy(CONSTRAINT),
  )
  // …and clearing it in the same statement is the legal way to do it.
  await app.db.update(gig_details).set({ remote: true, country: null, city: null }).where(eq(gig_details.escrow_id, row.escrow_id))
})

test('coordinates on a remote gig are NOT constrained: the validator accepts them (a geotag proof needs a pin)', { skip }, async () => {
  await resetDb(getApp())
  const { app, row } = await listing({ remote: true, latitude: 6.5244, longitude: 3.3792 })
  await app.db.insert(gig_details).values(row)
  const [stored] = await app.db.select().from(gig_details).where(eq(gig_details.escrow_id, row.escrow_id))
  assert.strictEqual(stored.latitude, 6.5244)
})

test('everything the validator accepts as remote is storable: a country on a remote body is dropped, not stored', { skip }, async () => {
  const app = getApp()
  await resetDb(app)
  const creator = await createUser(app)
  const escrow = await createEscrow(app, { creator_id: creator.row.id, status: 'draft' })
  const details = validateGigDetails(
    { title: 'Transcribe a recording', category: 'digital', remote: true, country: 'NG', city: 'Lagos', latitude: 6.5, longitude: 3.4 },
    'NG',
  )
  const stored = await upsertGigDetails(app.db, escrow.id, details)
  assert.strictEqual(stored.country, null)
  assert.strictEqual(stored.city, null)
  assert.strictEqual(stored.remote, true)
})
