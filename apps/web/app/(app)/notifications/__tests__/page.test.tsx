/**
 * Notification centre page: mount fetch, pinned announcements, mark-all
 * only while unread exists, row click = mark read + route (or stay put
 * for non-navigable notices), Load more only while a next page may exist.
 */
import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, expect, test, vi } from 'vitest'
import type { NotificationWire } from '@tenda/shared'
import NotificationsPage from '../page'
import { useNotificationsStore } from '@/stores/notifications.store'

const routerPush = vi.hoisted(() => vi.fn())
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: routerPush, back: vi.fn(), replace: vi.fn() }),
}))

const fetchFeed = vi.fn<() => Promise<void>>()
const fetchMore = vi.fn<() => Promise<void>>()
const markRead = vi.fn<(id: string) => Promise<void>>()
const markAllRead = vi.fn<() => Promise<void>>()

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

beforeEach(() => {
  vi.clearAllMocks()
  fetchFeed.mockResolvedValue()
  fetchMore.mockResolvedValue()
  markRead.mockResolvedValue()
  markAllRead.mockResolvedValue()
  useNotificationsStore.setState({
    notifications: [],
    announcements: [],
    unread: 0,
    loading: false,
    loadingMore: false,
    hasMore: false,
    fetchFeed,
    fetchMore,
    markRead,
    markAllRead,
  })
})

test('fetches the feed on mount and shows the empty state', () => {
  render(<NotificationsPage />)
  expect(fetchFeed).toHaveBeenCalledTimes(1)
  expect(screen.getByText('No notifications yet')).toBeInTheDocument()
})

test('announcements pin above rows; mark-all appears only with unread and drives the store', async () => {
  useNotificationsStore.setState({
    notifications: [notice({ id: 'n1' })],
    announcements: [{ id: 'a1', title: 'Fee update', body: 'Fees drop', priority: 1, published_at: null, expires_at: null }],
    unread: 1,
  })
  render(<NotificationsPage />)
  expect(screen.getByText('Fee update')).toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: 'Mark all read' }))
  expect(markAllRead).toHaveBeenCalledTimes(1)
})

test('no mark-all affordance when everything is read', () => {
  useNotificationsStore.setState({ notifications: [notice({ id: 'n1', read_at: '2026-08-15T11:00:00.000Z' })] })
  render(<NotificationsPage />)
  expect(screen.queryByRole('button', { name: 'Mark all read' })).toBeNull()
})

test('a routable row marks read and navigates; a non-navigable one only marks read', async () => {
  useNotificationsStore.setState({
    notifications: [
      notice({ id: 'n1' }),
      notice({ id: 'n2', title: 'Dispute update', data: { screen: 'dispute', escrowId: 'e2' } }),
    ],
  })
  render(<NotificationsPage />)
  await userEvent.click(screen.getByRole('button', { name: /Gig accepted/ }))
  expect(markRead).toHaveBeenCalledWith('n1')
  expect(routerPush).toHaveBeenCalledWith('/gig/e1')

  await userEvent.click(screen.getByRole('button', { name: /Dispute update/ }))
  expect(markRead).toHaveBeenCalledWith('n2')
  expect(routerPush).toHaveBeenCalledTimes(1) // no dispute surface yet — stays put
})

test('Load more shows only while a next page may exist and drives fetchMore', async () => {
  useNotificationsStore.setState({ notifications: [notice({ id: 'n1' })], hasMore: true })
  render(<NotificationsPage />)
  await userEvent.click(screen.getByRole('button', { name: 'Load more' }))
  expect(fetchMore).toHaveBeenCalledTimes(1)

  act(() => useNotificationsStore.setState({ hasMore: false }))
  expect(screen.queryByRole('button', { name: 'Load more' })).toBeNull()
})
