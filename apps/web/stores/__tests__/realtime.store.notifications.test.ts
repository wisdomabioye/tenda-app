/**
 * S5.3 fan-in on the `user:<id>` channel: notification frames reach the
 * notifications store, malformed notification payloads are dropped by the
 * guard, and chat mirrors keep working beside them.
 */
import { beforeEach, expect, test, vi } from 'vitest'
import { makeMessage } from '../../test/factories/chat'

const { channelListeners } = vi.hoisted(() => ({
  channelListeners: new Map<string, (frame: unknown) => void>(),
}))

vi.mock('@/lib/ws', () => ({
  ws: {
    subscribe: vi.fn((channel: string, listener: (frame: unknown) => void) => {
      channelListeners.set(channel, listener)
      return () => channelListeners.delete(channel)
    }),
    onConnectionChange: vi.fn(() => () => {}),
  },
}))

import { subscribeUserChannel } from '@/stores/realtime.store'
import { useNotificationsStore } from '@/stores/notifications.store'
import { useChatStore } from '@/stores/chat.store'

const receive = vi.fn<(n: { id: string }) => void>()
const fetchConversations = vi.fn<() => Promise<void>>()

beforeEach(() => {
  vi.clearAllMocks()
  channelListeners.clear()
  fetchConversations.mockResolvedValue()
  useNotificationsStore.setState({ receive })
  useChatStore.setState({ fetchConversations })
})

test('a notification frame feeds the notifications store', () => {
  subscribeUserChannel('me')
  channelListeners.get('user:me')?.({
    channel: 'user:me',
    type: 'notification',
    notification: { id: 'n1', title: 'Gig accepted', body: 'Bola accepted', data: null, read_at: null, created_at: null },
  })
  expect(receive).toHaveBeenCalledWith(expect.objectContaining({ id: 'n1' }))
  expect(fetchConversations).not.toHaveBeenCalled()
})

test('a malformed notification payload is dropped by the guard', () => {
  subscribeUserChannel('me')
  channelListeners.get('user:me')?.({
    channel: 'user:me',
    type: 'notification',
    notification: { id: 42, title: 'bad' }, // id not a string, body missing
  })
  expect(receive).not.toHaveBeenCalled()
})

test('chat mirrors and notification frames coexist on the one subscription', () => {
  subscribeUserChannel('me')
  const listener = channelListeners.get('user:me')
  listener?.({ channel: 'user:me', type: 'message', message: makeMessage({ id: 'm1' }) })
  expect(fetchConversations).toHaveBeenCalledTimes(1)
  expect(receive).not.toHaveBeenCalled()
})
