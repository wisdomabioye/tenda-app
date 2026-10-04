/**
 * The database-level rules on `gig_details`.
 *
 * What the CHECK does is proved against a real database in the server's
 * integration suite (gig-details-remote-check). This pins the part only the
 * schema can: that the constraint is DECLARED, once, under the name the
 * migration and the violation messages use. A rename or a deletion in the
 * schema file would otherwise only show up as a missing migration.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { getTableConfig } from 'drizzle-orm/pg-core'
import { gig_details } from '../../src/db/schema/escrow/gig'

test('gig_details declares the remote-has-no-location constraint, exactly once', () => {
  const names = getTableConfig(gig_details).checks.map((c) => c.name)
  assert.deepEqual(names.filter((n) => n === 'gig_details_remote_no_location'), ['gig_details_remote_no_location'])
})

test('gig_details declares no other CHECK: coordinates on a remote gig are deliberately unconstrained', () => {
  // The validator keeps latitude/longitude on a remote gig (a geotag proof
  // needs a pin), so a second check over them would turn an accepted request
  // into a constraint violation. A new rule belongs here only with its reason.
  assert.deepEqual(getTableConfig(gig_details).checks.map((c) => c.name), ['gig_details_remote_no_location'])
})
