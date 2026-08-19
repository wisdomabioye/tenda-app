/**
 * conversationsApi / notificationsApi / subscriptionsApi — verb, route and
 * payload per method. Fourteen methods that were at 0% coverage: each encodes
 * an HTTP verb and a route constant, which is exactly what drifts from the
 * server silently.
 *
 * One pairing is worth reading twice: registerToken and removeToken are the
 * SAME path on different verbs, so a copied line survives review and unregisters
 * a device when it meant to register one.
 */
import { beforeEach, expect, test, vi } from 'vitest'
import { apiRoutes } from '@tenda/shared'
import { request } from '../../request'
import { conversationsApi, notificationsApi, subscriptionsApi } from '../messaging'
import { expectClientCall, type ClientCase } from '../__fixtures__/client-table'

vi.mock('../../request', () => ({ request: vi.fn() }))

const requestMock = vi.mocked(request)
const { conversations, notifications, subscriptions } = apiRoutes
const id = { id: 'c1' }

beforeEach(() => {
  requestMock.mockReset().mockResolvedValue({})
})

const CASES: ClientCase[] = [
  { name: 'conversations.list', call: () => conversationsApi.list(), method: 'GET', path: conversations.list },
  {
    name: 'conversations.findOrCreate',
    call: () => conversationsApi.findOrCreate({ user_id: 'u2' }),
    method: 'POST',
    path: conversations.findOrCreate,
    options: { body: { user_id: 'u2' } },
  },
  {
    name: 'conversations.messages (scoped, no query)',
    call: () => conversationsApi.messages(id),
    method: 'GET',
    path: conversations.messages,
    options: { params: id, query: undefined },
  },
  {
    name: 'conversations.messages (scoped, with query)',
    call: () => conversationsApi.messages(id, { limit: 50 }),
    method: 'GET',
    path: conversations.messages,
    options: { params: id, query: { limit: 50 } },
  },
  {
    name: 'conversations.sendMessage',
    call: () => conversationsApi.sendMessage(id, { content: 'hi' }),
    method: 'POST',
    path: conversations.sendMessage,
    options: { params: id, body: { content: 'hi' } },
  },
  {
    name: 'conversations.close',
    call: () => conversationsApi.close(id),
    method: 'POST',
    path: conversations.close,
    options: { params: id },
  },
  {
    name: 'notifications.feed (query omitted)',
    call: () => notificationsApi.feed(),
    method: 'GET',
    path: notifications.list,
    options: { query: undefined },
  },
  {
    name: 'notifications.feed (query given)',
    call: () => notificationsApi.feed({ limit: 20 }),
    method: 'GET',
    path: notifications.list,
    options: { query: { limit: 20 } },
  },
  {
    name: 'notifications.unreadCount',
    call: () => notificationsApi.unreadCount(),
    method: 'GET',
    path: notifications.unreadCount,
  },
  {
    name: 'notifications.markRead',
    call: () => notificationsApi.markRead({ id: 'n1' }),
    method: 'POST',
    path: notifications.markRead,
    options: { params: { id: 'n1' } },
  },
  {
    name: 'notifications.markAllRead',
    call: () => notificationsApi.markAllRead(),
    method: 'POST',
    path: notifications.markAllRead,
  },
  { name: 'subscriptions.list', call: () => subscriptionsApi.list(), method: 'GET', path: subscriptions.list },
  {
    name: 'subscriptions.upsert',
    call: () => subscriptionsApi.upsert({ category: 'delivery', city: '*' }),
    method: 'POST',
    path: subscriptions.upsert,
    options: { body: { category: 'delivery', city: '*' } },
  },
  {
    name: 'subscriptions.remove',
    call: () => subscriptionsApi.remove({ id: 's1' }),
    method: 'DELETE',
    path: subscriptions.remove,
    options: { params: { id: 's1' } },
  },
]

test.each(CASES.map((c) => [c.name, c] as const))('%s', async (_name, testCase) => {
  await expectClientCall(requestMock, testCase)
})

test('register and remove share one path and are told apart by the VERB', async () => {
  await notificationsApi.registerToken({ token: 't1', platform: 'expo' })
  expect(requestMock).toHaveBeenLastCalledWith('POST', notifications.registerToken, {
    body: { token: 't1', platform: 'expo' },
  })

  await notificationsApi.removeToken({ token: 't1' })
  expect(requestMock).toHaveBeenLastCalledWith('DELETE', notifications.registerToken, {
    body: { token: 't1' },
  })
})
