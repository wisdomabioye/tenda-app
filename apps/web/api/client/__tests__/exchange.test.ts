/**
 * exchangeApi / disputesApi — verb, route and payload per method.
 *
 * `disputes.mine` lives in this module rather than its own: it is caller-scoped
 * like /v1/conversations, identity coming from the JWT and not from a path
 * param, which is what keeps a dispute findable after its push notification is
 * gone.
 */
import { beforeEach, expect, test, vi } from 'vitest'
import { apiRoutes } from '@tenda/shared'
import { request } from '../../request'
import { disputesApi, exchangeApi } from '../exchange'
import { expectClientCall, type ClientCase } from '../__fixtures__/client-table'

vi.mock('../../request', () => ({ request: vi.fn() }))

const requestMock = vi.mocked(request)
const { exchange, disputes } = apiRoutes

beforeEach(() => {
  requestMock.mockReset().mockResolvedValue({})
})

const CASES: ClientCase[] = [
  {
    name: 'exchange.list (query omitted)',
    call: () => exchangeApi.list(),
    method: 'GET',
    path: exchange.list,
    options: { query: undefined },
  },
  {
    name: 'exchange.list (query given)',
    call: () => exchangeApi.list({ currency: 'NGN', limit: 20 }),
    method: 'GET',
    path: exchange.list,
    options: { query: { currency: 'NGN', limit: 20 } },
  },
  {
    name: 'exchange.create',
    call: () =>
      exchangeApi.create({
        escrow_id: 'e1',
        fiat_amount: 75_000,
        fiat_currency: 'NGN',
        rate: 1500,
        payout_account_id: 'b1',
      }),
    method: 'POST',
    path: exchange.create,
    options: {
      body: {
        escrow_id: 'e1',
        fiat_amount: 75_000,
        fiat_currency: 'NGN',
        rate: 1500,
        payout_account_id: 'b1',
      },
    },
  },
  {
    name: 'exchange.get (scoped)',
    call: () => exchangeApi.get({ id: 'e1' }),
    method: 'GET',
    path: exchange.get,
    options: { params: { id: 'e1' } },
  },
  {
    name: 'disputes.mine (query given)',
    call: () => disputesApi.mine({ limit: 20 }),
    method: 'GET',
    path: disputes.mine,
    options: { query: { limit: 20 } },
  },
]

test.each(CASES.map((c) => [c.name, c] as const))('%s', async (_name, testCase) => {
  await expectClientCall(requestMock, testCase)
})

test('the caller’s own disputes are NOT reached by a user id in the path', async () => {
  await disputesApi.mine()
  const [, path] = requestMock.mock.calls.at(-1) ?? []
  expect(path).toBe(disputes.mine)
  expect(String(path)).not.toContain(':id')
})
