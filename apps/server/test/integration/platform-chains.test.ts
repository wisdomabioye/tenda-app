/**
 * CO5 (#74): GET /v1/platform/chains — the chain/asset picker source.
 * Enabled chains carry their enabled assets; disabled rows never surface.
 *
 * Real app via fastify.inject; gated on TEST_DATABASE_URL (helpers/test-app).
 */
import { test } from 'node:test'
import assert from 'node:assert'
import { eq } from 'drizzle-orm'
import { assets, chains } from '@tenda/shared/db/schema'
import {
  TEST_DB_CONFIGURED,
  TEST_CHAIN_ID,
  TEST_ASSET,
  TEST_NATIVE_ASSET,
  useTestApp,
} from '../helpers/test-app'

const skip = !TEST_DB_CONFIGURED
const getApp = useTestApp()

test('platform/chains: enabled chains with their enabled assets', { skip }, async () => {
  const app = getApp()
  const res = await app.inject({ method: 'GET', url: '/v1/platform/chains' })
  assert.strictEqual(res.statusCode, 200)
  const { data } = res.json()
  assert.strictEqual(data.length, 1)
  assert.strictEqual(data[0].id, TEST_CHAIN_ID)
  assert.strictEqual(data[0].namespace, 'solana')
  assert.deepStrictEqual(
    data[0].assets.map((a: { id: string }) => a.id).sort(),
    [TEST_NATIVE_ASSET, TEST_ASSET].sort(),
  )
  const usdc = data[0].assets.find((a: { id: string }) => a.id === TEST_ASSET)
  // token_address is the single source the mobile balance reader consumes.
  assert.deepStrictEqual(usdc, {
    id: TEST_ASSET,
    symbol: 'USDC',
    decimals: 6,
    is_stable: true,
    token_address: '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU',
  })
  // Native gas asset carries a null token_address (not a contract).
  const native = data[0].assets.find((a: { id: string }) => a.id === TEST_NATIVE_ASSET)
  assert.strictEqual(native.token_address, null)
})

test('platform/chains: disabled assets and chains drop out', { skip }, async () => {
  const app = getApp()
  await app.db.update(assets).set({ is_enabled: false }).where(eq(assets.id, TEST_NATIVE_ASSET))
  const partial = await app.inject({ method: 'GET', url: '/v1/platform/chains' })
  assert.deepStrictEqual(
    partial.json().data[0].assets.map((a: { id: string }) => a.id),
    [TEST_ASSET],
  )

  await app.db.update(chains).set({ is_enabled: false }).where(eq(chains.id, TEST_CHAIN_ID))
  const none = await app.inject({ method: 'GET', url: '/v1/platform/chains' })
  assert.deepStrictEqual(none.json().data, [])
})
