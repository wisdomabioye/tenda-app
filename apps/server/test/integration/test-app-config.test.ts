/** Regression: an eager config read must not bypass the test database lease. */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { sql } from 'drizzle-orm'
import { getConfig } from '@server/config'
import { TEST_DB_CONFIGURED, useTestApp } from '../helpers/test-app'

const baseUrl = getConfig().DATABASE_URL // Deliberately BEFORE the before hook.
const getApp = useTestApp()

test('the app and cached configuration both use the leased database', {
  skip: !TEST_DB_CONFIGURED,
}, async () => {
  const configuredUrl = getConfig().DATABASE_URL
  assert.notEqual(configuredUrl, baseUrl, 'the base database must never back a leased app')
  assert.equal(configuredUrl, process.env.DATABASE_URL)
  const rows = await getApp().db.execute<{ name: string }>(sql`select current_database() as name`)
  assert.equal(rows[0].name, new URL(configuredUrl).pathname.slice(1))
})
