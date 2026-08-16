/**
 * The chat-facing channel subscriptions added in S5.2: `chat:<id>` frames
 * feed receiveMessage (non-message frames filtered), and the `user:<id>`
 * inbox mirror refetches conversations on chat frames while letting
 * notification frames fall through (S5.3's concern).
 */
import { beforeEach, expect, test, vi } from 'vitest'
import type { WsFrame } from '@/lib/ws'
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

import { subscribeChatChannel, subscribeUserChannel } from '@/stores/realtime.store'
import { useChatStore } from '@/stores/chat.store'

const receiveMessage = vi.fn<(conversationId: string, message: ReturnType<typeof makeMessage>) => void>()
const fetchConversations = vi.fn<() => Promise<void>>()

function chatFrame(channel: string): WsFrame {
  return { channel, type: 'message', message: makeMessage({ id: 'm1' }) }
}

beforeEach(() => {
  vi.clearAllMocks()
  channelListeners.clear()
  fetchConversations.mockResolvedValue()
  useChatStore.setState({ receiveMessage, fetchConversations })
})

test('chat channel: message frames reach receiveMessage and the onMessage callback', () => {
  const onMessage = vi.fn()
  const unsubscribe = subscribeChatChannel('c1', onMessage)
  const listener = channelListeners.get('chat:c1')
  expect(listener).toBeDefined()

  listener?.(chatFrame('chat:c1'))
  expect(receiveMessage).toHaveBeenCalledWith('c1', expect.objectContaining({ id: 'm1' }))
  expect(onMessage).toHaveBeenCalledWith(expect.objectContaining({ id: 'm1' }))

  // A non-message frame on the channel is filtered.
  listener?.({ channel: 'chat:c1', type: 'escrow_event', escrow_id: 'e', event: 'X', tx_ref: 't' })
  expect(receiveMessage).toHaveBeenCalledTimes(1)

  unsubscribe()
  expect(channelListeners.has('chat:c1')).toBe(false)
})

test('user channel: a mirrored chat frame refetches conversations; a notification frame falls through', () => {
  subscribeUserChannel('me')
  const listener = channelListeners.get('user:me')
  expect(listener).toBeDefined()

  listener?.(chatFrame('user:me'))
  expect(fetchConversations).toHaveBeenCalledTimes(1)

  listener?.({
    channel: 'user:me',
    type: 'notification',
    notification: { id: 'n1', title: 'T', body: 'B' },
  })
  expect(fetchConversations).toHaveBeenCalledTimes(1) // untouched — S5.3 owns these
})

test('user channel: a failing refetch is contained (next frame or poll catches up)', () => {
  fetchConversations.mockRejectedValue(new Error('down'))
  subscribeUserChannel('me')
  expect(() => channelListeners.get('user:me')?.(chatFrame('user:me'))).not.toThrow()
})
