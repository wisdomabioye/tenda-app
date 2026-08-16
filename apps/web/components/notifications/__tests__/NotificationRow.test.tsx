/**
 * Row rendering + the icon map: unread carries the dot and aria suffix,
 * icons derive from the shared screen vocabulary.
 */
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, test, vi } from 'vitest'
import { Bell, Handshake, ArrowLeftRight, Scale } from 'lucide-react'
import type { NotificationWire } from '@tenda/shared'
import { NotificationRow } from '@/components/notifications/NotificationRow'
import { notificationIcon } from '@/components/notifications/notification-icon'

function notice(over: Partial<NotificationWire> = {}): NotificationWire {
  return {
    id: 'n1',
    title: 'Gig accepted',
    body: 'Bola accepted your gig',
    data: { screen: 'escrow', escrowId: 'e1', kind: 'gig' },
    read_at: null,
    created_at: '2026-08-15T10:00:00.000Z',
    ...over,
  }
}

test('unread row: inset dot, aria suffix, click fires', async () => {
  const onPress = vi.fn()
  render(<NotificationRow notification={notice()} onPress={onPress} />)
  const row = screen.getByRole('button', { name: 'Gig accepted, unread' })
  expect(screen.getByTestId('notification-unread-dot')).toBeInTheDocument()
  expect(screen.getByText('Bola accepted your gig')).toBeInTheDocument()
  await userEvent.click(row)
  expect(onPress).toHaveBeenCalled()
})

test('read row: no dot, plain aria label', () => {
  render(
    <NotificationRow notification={notice({ read_at: '2026-08-15T11:00:00.000Z' })} onPress={vi.fn()} />,
  )
  expect(screen.getByRole('button', { name: 'Gig accepted' })).toBeInTheDocument()
  expect(screen.queryByTestId('notification-unread-dot')).toBeNull()
})

test('icon map: gig→Handshake, exchange→ArrowLeftRight, dispute→Scale, else Bell', () => {
  expect(notificationIcon({ screen: 'escrow', kind: 'gig' })).toBe(Handshake)
  expect(notificationIcon({ screen: 'escrow', kind: 'exchange' })).toBe(ArrowLeftRight)
  expect(notificationIcon({ screen: 'dispute' })).toBe(Scale)
  expect(notificationIcon({ screen: 'other' })).toBe(Bell)
  expect(notificationIcon(null)).toBe(Bell)
})
