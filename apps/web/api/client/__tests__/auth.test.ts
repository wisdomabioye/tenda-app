/**
 * authApi — verb, route and payload per method.
 *
 * The rule worth more than the table: which calls carry the bearer. `challenge`
 * and `verify` are the SAME endpoints for signing in and for linking an
 * identity to an existing account, and the server tells the two apart by
 * whether a bearer arrived. Sending a stored (possibly dead) token on the
 * sign-in path would 401 every retry; omitting it on the link path would
 * create a second account instead of attaching to the current one.
 */
import { beforeEach, expect, test, vi } from 'vitest'
import { apiRoutes } from '@tenda/shared'
import { request } from '../../request'
import { authApi } from '../auth'
import { expectClientCall, type ClientCase } from '../__fixtures__/client-table'

vi.mock('../../request', () => ({ request: vi.fn() }))

const requestMock = vi.mocked(request)
const { auth } = apiRoutes

beforeEach(() => {
  requestMock.mockReset().mockResolvedValue({})
})

const CASES: ClientCase[] = [
  { name: 'nonce', call: () => authApi.nonce(), method: 'POST', path: auth.nonce },
  { name: 'me', call: () => authApi.me(), method: 'GET', path: auth.me },
  { name: 'methods', call: () => authApi.methods(), method: 'GET', path: auth.methods },
  {
    name: 'linkWallet',
    call: () =>
      authApi.linkWallet({ chain_id: 'solana:devnet', address: 'SoL1', message: 'm', signature: 's' }),
    method: 'POST',
    path: auth.linkWallet,
    options: { body: { chain_id: 'solana:devnet', address: 'SoL1', message: 'm', signature: 's' } },
  },
  {
    name: 'unlinkWallet',
    call: () => authApi.unlinkWallet({ chain_ns: 'solana', address: 'SoL1' }),
    method: 'POST',
    path: auth.unlinkWallet,
    options: { body: { chain_ns: 'solana', address: 'SoL1' } },
  },
  {
    name: 'setPrimaryWallet',
    call: () => authApi.setPrimaryWallet({ chain_ns: 'solana', address: 'SoL1' }),
    method: 'POST',
    path: auth.setPrimaryWallet,
    options: { body: { chain_ns: 'solana', address: 'SoL1' } },
  },
]

test.each(CASES.map((c) => [c.name, c] as const))('%s', async (_name, testCase) => {
  await expectClientCall(requestMock, testCase)
})

// ---------- the bearer discriminator ---------------------------------------

test('challenge and verify are ANONYMOUS by default — that is signing in', async () => {
  await authApi.challenge({ method: 'email', identifier: 'a@b.test' })
  expect(requestMock).toHaveBeenLastCalledWith('POST', auth.challenge, {
    body: { method: 'email', identifier: 'a@b.test' },
    auth: false,
  })

  await authApi.verify({ method: 'email', identifier: 'a@b.test', code: '123456' })
  expect(requestMock).toHaveBeenLastCalledWith('POST', auth.verify, {
    body: { method: 'email', identifier: 'a@b.test', code: '123456' },
    auth: false,
  })
})

test('link: true attaches the bearer — that is adding a method to THIS account', async () => {
  await authApi.challenge({ method: 'email', identifier: 'a@b.test' }, { link: true })
  expect(requestMock).toHaveBeenLastCalledWith('POST', auth.challenge, {
    body: { method: 'email', identifier: 'a@b.test' },
    auth: true,
  })

  await authApi.verify({ method: 'email', identifier: 'a@b.test', code: '123456' }, { link: true })
  expect(requestMock).toHaveBeenLastCalledWith('POST', auth.verify, {
    body: { method: 'email', identifier: 'a@b.test', code: '123456' },
    auth: true,
  })
})

test('an options object without `link` is still anonymous', async () => {
  // `opts?.link === true` and not a truthiness test: `{}` must not be read as
  // "link", or a sign-in would silently become a link attempt.
  await authApi.challenge({ method: 'email', identifier: 'a@b.test' }, {})
  expect(requestMock).toHaveBeenLastCalledWith('POST', auth.challenge, {
    body: { method: 'email', identifier: 'a@b.test' },
    auth: false,
  })
})
