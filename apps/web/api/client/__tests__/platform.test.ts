/**
 * platformApi / blockchainApi / uploadApi / moderationApi / reportsApi — verb,
 * route and payload per method.
 *
 * The two non-default timeouts are the point of the file beyond the table.
 * `permitPayload` reads name/nonces/DOMAIN_SEPARATOR off the token over RPC,
 * and `moderation.preview` waits on a content check; both would be aborted
 * mid-flight by the default budget, and the failure would look like a flaky
 * network rather than a timeout that was always going to fire.
 */
import { beforeEach, expect, test, vi } from 'vitest'
import { apiRoutes } from '@tenda/shared'
import { request } from '../../request'
import { blockchainApi, moderationApi, platformApi, reportsApi, uploadApi } from '../platform'
import { MODERATION_TIMEOUT_MS, TX_BUILD_TIMEOUT_MS } from '../timeouts'
import { apiConfig } from '@/lib/config/api-config'
import { expectClientCall, type ClientCase } from '../__fixtures__/client-table'

vi.mock('../../request', () => ({ request: vi.fn() }))

const requestMock = vi.mocked(request)
const { platform, blockchain, upload, reports, moderation } = apiRoutes

beforeEach(() => {
  requestMock.mockReset().mockResolvedValue({})
})

const CASES: ClientCase[] = [
  { name: 'platform.config', call: () => platformApi.config(), method: 'GET', path: platform.config },
  {
    name: 'platform.exchangeRates',
    call: () => platformApi.exchangeRates(),
    method: 'GET',
    path: platform.exchangeRates,
  },
  { name: 'platform.chains', call: () => platformApi.chains(), method: 'GET', path: platform.chains },
  {
    name: 'blockchain.clientPing',
    call: () => blockchainApi.clientPing({ tx_ref: 'sig-1', action: 'create', chain_id: 'solana:devnet' }),
    method: 'POST',
    path: blockchain.clientPing,
    options: { body: { tx_ref: 'sig-1', action: 'create', chain_id: 'solana:devnet' } },
  },
  {
    name: 'upload.signature',
    call: () => uploadApi.signature({ type: 'avatar' }),
    method: 'POST',
    path: upload.signature,
    options: { body: { type: 'avatar' } },
  },
  {
    name: 'reports.create',
    call: () => reportsApi.create({ content_type: 'escrow', content_id: 'e1', reason: 'spam' }),
    method: 'POST',
    path: reports.create,
    options: { body: { content_type: 'escrow', content_id: 'e1', reason: 'spam' } },
  },
]

test.each(CASES.map((c) => [c.name, c] as const))('%s', async (_name, testCase) => {
  await expectClientCall(requestMock, testCase)
})

test('permitPayload gets the RPC-aware build budget, not the default', async () => {
  const body = {
    chain_id: 'eip155:84532',
    asset: 'USDC_BASE',
    value_raw: '1000000',
    owner: '0xowner',
  }
  await blockchainApi.permitPayload(body)
  expect(requestMock).toHaveBeenLastCalledWith('POST', blockchain.permitPayload, {
    body,
    timeout: TX_BUILD_TIMEOUT_MS,
  })
})

test('moderation preview gets the moderation budget, not the default', async () => {
  const body = {
    title: 'Deliver a parcel',
    description: 'Collect and deliver',
    category: 'delivery',
    country: 'NG',
    asset: 'USDC_SOL',
    amount_raw: '25000000',
    asset_decimals: 6,
  }
  await moderationApi.preview(body)
  expect(requestMock).toHaveBeenLastCalledWith('POST', moderation.preview, {
    body,
    timeout: MODERATION_TIMEOUT_MS,
  })
})

test('every raised budget really is above the global request timeout', () => {
  // The whole reason timeouts.ts exists: "both raised above the global
  // apiConfig[env].timeout because the SERVER is slow on purpose for those
  // calls". A budget that slipped to or below the default would be an override
  // that overrides nothing, and the symptom is a raw "Aborted" with the wallet
  // never opening — which reads as a flaky network, not as a config mistake.
  //
  // They are all 20_000 TODAY. That is not asserted: they are separate
  // constants with separate reasons (an LLM round trip, an RPC read), and
  // pinning them equal would turn a coincidence into a contract.
  for (const env of ['development', 'staging', 'production'] as const) {
    expect(MODERATION_TIMEOUT_MS).toBeGreaterThan(apiConfig[env].timeout)
    expect(TX_BUILD_TIMEOUT_MS).toBeGreaterThan(apiConfig[env].timeout)
  }
})
