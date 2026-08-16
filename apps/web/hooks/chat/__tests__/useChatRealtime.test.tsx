/**
 * Thread realtime orchestration: channel subscription per conversation,
 * debounced read-sync for THEIR messages only, one catch-up fetch on
 * reconnect, and the DoD assertion — the fallback poll runs ONLY while
 * the socket is down.
 */
import { renderHook, act } from '@testing-library/react'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import type { Message } from '@tenda/shared'

const { channel, polledWith } = vi.hoisted(() => ({
  channel: {
    id: null as string | null,
    listener: null as ((message: Message) => void) | null,
    unsubscribed: 0,
  },
  polledWith: { current: [] as Array<string | null> },
}))

vi.mock('@/stores/realtime.store', async () => {
  const { create } = await import('zustand')
  return {
    useRealtimeStore: create<{ connected: boolean }>(() => ({ connected: false })),
    subscribeChatChannel: (id: string, onMessage?: (message: Message) => void) => {
      channel.id = id
      channel.listener = onMessage ?? null
      return () => {
        channel.unsubscribed += 1
        channel.listener = null
      }
    },
  }
})

vi.mock('@/hooks/chat/useMessagePolling', () => ({
  useMessagePolling: (id: string | null) => {
    polledWith.current.push(id)
  },
}))

import { useChatRealtime } from '@/hooks/chat/useChatRealtime'
import { useRealtimeStore } from '@/stores/realtime.store'
import { useChatStore } from '@/stores/chat.store'
import { useAuthStore } from '@/stores/auth.store'
import { makeUser } from '../../../test/factories/user'

const fetchMessages = vi.fn<(conversationId: string, beforeId?: string) => Promise<Message[]>>()

function themMessage(id: string): Message {
  return {
    id,
    conversation_id: 'c1',
    sender_id: 'them',
    escrow_id: null,
    escrow_title: null,
    escrow_kind: null,
    content: 'hi',
    read_at: null,
    created_at: '2026-08-16T09:00:00.000Z',
    attachment_url: null,
    attachment_type: null,
    attachment_size: null,
  }
}

beforeEach(() => {
  vi.useFakeTimers()
  fetchMessages.mockReset().mockResolvedValue([])
  channel.id = null
  channel.listener = null
  channel.unsubscribed = 0
  polledWith.current = []
  useRealtimeStore.setState({ connected: false })
  useChatStore.setState({ fetchMessages })
  useAuthStore.setState({ user: makeUser({ id: 'me' }) })
})

afterEach(() => {
  vi.useRealTimers()
})

test('subscribes to the conversation channel and unsubscribes on unmount', () => {
  const { unmount } = renderHook(() => useChatRealtime('c1'))
  expect(channel.id).toBe('c1')
  unmount()
  expect(channel.unsubscribed).toBe(1)
})

test('a THEIR frame schedules ONE debounced read-sync fetch; my own echo schedules none', async () => {
  renderHook(() => useChatRealtime('c1'))

  act(() => channel.listener?.({ ...themMessage('m1'), sender_id: 'me' }))
  await act(() => vi.advanceTimersByTimeAsync(2_000))
  expect(fetchMessages).not.toHaveBeenCalled()

  act(() => {
    channel.listener?.(themMessage('m2'))
    channel.listener?.(themMessage('m3')) // debounce collapses the pair
  })
  await act(() => vi.advanceTimersByTimeAsync(1_000))
  expect(fetchMessages).toHaveBeenCalledTimes(1)
})

test('poll runs ONLY while the socket is down: null id is passed while connected', () => {
  useRealtimeStore.setState({ connected: true })
  const { rerender } = renderHook(() => useChatRealtime('c1'))
  expect(polledWith.current.at(-1)).toBeNull()

  act(() => useRealtimeStore.setState({ connected: false }))
  rerender()
  expect(polledWith.current.at(-1)).toBe('c1')
})

test('a disconnected→connected transition fires exactly one catch-up fetch', () => {
  renderHook(() => useChatRealtime('c1'))
  expect(fetchMessages).not.toHaveBeenCalled()
  act(() => useRealtimeStore.setState({ connected: true }))
  expect(fetchMessages).toHaveBeenCalledTimes(1)
  act(() => useRealtimeStore.setState({ connected: true }))
  expect(fetchMessages).toHaveBeenCalledTimes(1)
})
