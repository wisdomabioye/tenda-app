/**
 * Notification store behavior: server-authoritative badge on fetch, cursor
 * pagination with mid-flight dedupe, optimistic mark-read that reconciles
 * on failure, WS receive dedupe, and the logout reset.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NOTIFICATION_PAGE_SIZE } from '@tenda/shared'
import type { NotificationFeed, NotificationWire } from '@tenda/shared'

const notificationsApi = vi.hoisted(() => ({
  feed: vi.fn<(q?: { before_id: string }) => Promise<NotificationFeed>>(),
  unreadCount: vi.fn<() => Promise<{ count: number }>>(),
  markRead: vi.fn<(p: { id: string }) => Promise<{ ok: boolean }>>(),
  markAllRead: vi.fn<() => Promise<{ ok: boolean }>>(),
}))

vi.mock('@/api/client', () => ({ api: { notifications: notificationsApi } }))

import { useNotificationsStore } from '@/stores/notifications.store'

function notice(over: Partial<NotificationWire> & { id: string }): NotificationWire {
  return {
    title: 'Gig accepted',
    body: 'Bola accepted your gig',
    data: { screen: 'escrow', escrowId: 'e1', kind: 'gig' },
    read_at: null,
    created_at: '2026-08-15T10:00:00.000Z',
    ...over,
  }
}

function page(n: number, offset = 0): NotificationWire[] {
  return Array.from({ length: n }, (_, i) => notice({ id: `n-${offset + i}` }))
}

beforeEach(() => {
  vi.clearAllMocks()
  useNotificationsStore.getState().reset()
})

describe('fetchFeed', () => {
  it('stores the feed, badge count, and a full page means more may exist', async () => {
    notificationsApi.feed.mockResolvedValue({
      notifications: page(NOTIFICATION_PAGE_SIZE),
      announcements: [{ id: 'a1', title: 'Fees', body: 'Fee update', priority: 1, published_at: null, expires_at: null }],
      unread_count: 7,
    })
    await useNotificationsStore.getState().fetchFeed()
    const s = useNotificationsStore.getState()
    expect(s.unread).toBe(7)
    expect(s.announcements).toHaveLength(1)
    expect(s.hasMore).toBe(true)
    expect(s.loading).toBe(false)
  })

  it('a short page means the feed is complete; a failure clears loading', async () => {
    notificationsApi.feed.mockResolvedValue({ notifications: page(2), announcements: [], unread_count: 0 })
    await useNotificationsStore.getState().fetchFeed()
    expect(useNotificationsStore.getState().hasMore).toBe(false)

    notificationsApi.feed.mockRejectedValue(new Error('down'))
    await useNotificationsStore.getState().fetchFeed()
    expect(useNotificationsStore.getState().loading).toBe(false)
  })
})

describe('fetchMore', () => {
  it('pages from the oldest loaded id and dedupes overlap', async () => {
    useNotificationsStore.setState({ notifications: page(NOTIFICATION_PAGE_SIZE), hasMore: true })
    const older = [notice({ id: `n-${NOTIFICATION_PAGE_SIZE - 1}` }), notice({ id: 'older-1' })]
    notificationsApi.feed.mockResolvedValue({ notifications: older, announcements: [], unread_count: 0 })

    await useNotificationsStore.getState().fetchMore()
    expect(notificationsApi.feed).toHaveBeenCalledWith({ before_id: `n-${NOTIFICATION_PAGE_SIZE - 1}` })
    const ids = useNotificationsStore.getState().notifications.map((n) => n.id)
    expect(ids.filter((id) => id === `n-${NOTIFICATION_PAGE_SIZE - 1}`)).toHaveLength(1) // deduped
    expect(ids).toContain('older-1')
    expect(useNotificationsStore.getState().hasMore).toBe(false) // short page
  })

  it('is inert without a cursor, when exhausted, or while loading', async () => {
    await useNotificationsStore.getState().fetchMore() // empty list → no cursor
    useNotificationsStore.setState({ notifications: page(3), hasMore: false })
    await useNotificationsStore.getState().fetchMore() // exhausted
    useNotificationsStore.setState({ hasMore: true, loading: true })
    await useNotificationsStore.getState().fetchMore() // initial load in flight
    expect(notificationsApi.feed).not.toHaveBeenCalled()
  })
})

describe('badge + receive', () => {
  it('refreshUnread is server-authoritative and keeps the last value on failure', async () => {
    notificationsApi.unreadCount.mockResolvedValue({ count: 4 })
    await useNotificationsStore.getState().refreshUnread()
    expect(useNotificationsStore.getState().unread).toBe(4)

    notificationsApi.unreadCount.mockRejectedValue(new Error('down'))
    await useNotificationsStore.getState().refreshUnread()
    expect(useNotificationsStore.getState().unread).toBe(4)
  })

  it('receive prepends, bumps only unread notices, and dedupes by id', () => {
    const s = useNotificationsStore.getState()
    s.receive(notice({ id: 'n1' }))
    s.receive(notice({ id: 'n1' })) // duplicate frame
    s.receive(notice({ id: 'n2', read_at: '2026-08-15T10:00:00.000Z' })) // already read
    const after = useNotificationsStore.getState()
    expect(after.notifications.map((n) => n.id)).toEqual(['n2', 'n1'])
    expect(after.unread).toBe(1)
  })
})

describe('mark read', () => {
  it('markRead is optimistic, floors at zero, and skips read/absent notices', async () => {
    useNotificationsStore.setState({ notifications: [notice({ id: 'n1' })], unread: 1 })
    notificationsApi.markRead.mockResolvedValue({ ok: true })
    await useNotificationsStore.getState().markRead('n1')
    expect(useNotificationsStore.getState().unread).toBe(0)
    expect(useNotificationsStore.getState().notifications[0].read_at).not.toBeNull()

    await useNotificationsStore.getState().markRead('n1') // already read
    await useNotificationsStore.getState().markRead('ghost') // absent
    expect(notificationsApi.markRead).toHaveBeenCalledTimes(1)
  })

  it('markAllRead clears every notice and the badge optimistically', async () => {
    useNotificationsStore.setState({
      notifications: [notice({ id: 'n1' }), notice({ id: 'n2' })],
      unread: 2,
    })
    notificationsApi.markAllRead.mockResolvedValue({ ok: true })
    await useNotificationsStore.getState().markAllRead()
    const s = useNotificationsStore.getState()
    expect(s.unread).toBe(0)
    expect(s.notifications.every((n) => n.read_at !== null)).toBe(true)
    expect(notificationsApi.markAllRead).toHaveBeenCalledTimes(1)
  })

  it('a failing markRead keeps the optimistic state (next fetch reconciles)', async () => {
    useNotificationsStore.setState({ notifications: [notice({ id: 'n1' })], unread: 1 })
    notificationsApi.markRead.mockRejectedValue(new Error('down'))
    await useNotificationsStore.getState().markRead('n1')
    expect(useNotificationsStore.getState().unread).toBe(0)
  })
})

it('reset drops everything for the next account', () => {
  useNotificationsStore.setState({ notifications: page(3), unread: 3, hasMore: true })
  useNotificationsStore.getState().reset()
  const s = useNotificationsStore.getState()
  expect(s.notifications).toEqual([])
  expect(s.unread).toBe(0)
  expect(s.hasMore).toBe(false)
})
