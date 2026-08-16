/**
 * Inbox row: routes to /chat/<other user>, unread badge with 9+ clamp,
 * preview fallback for empty threads, Anonymous for nameless users.
 */
import { render, screen } from '@testing-library/react'
import { expect, test } from 'vitest'
import { ConversationItem } from '@/components/chat/ConversationItem'
import { makeConversation } from '../../../test/factories/chat'

test('links to the other user thread and shows name + preview', () => {
  render(<ConversationItem conversation={makeConversation({ id: 'c1' })} />)
  const link = screen.getByRole('link', { name: 'Open chat with Ada Okafor' })
  expect(link).toHaveAttribute('href', '/chat/them')
  expect(screen.getByText('hi')).toBeInTheDocument()
})

test('unread shows the count badge and the avatar dot; 9+ clamps', () => {
  const { rerender } = render(
    <ConversationItem conversation={makeConversation({ id: 'c1', unread_count: 3 })} />,
  )
  expect(screen.getByText('3')).toBeInTheDocument()
  expect(screen.getByTestId('avatar-unread-dot')).toBeInTheDocument()

  rerender(<ConversationItem conversation={makeConversation({ id: 'c1', unread_count: 12 })} />)
  expect(screen.getByText('9+')).toBeInTheDocument()
})

test('empty thread previews the placeholder; nameless user reads Anonymous', () => {
  render(
    <ConversationItem
      conversation={makeConversation({
        id: 'c1',
        last_message: null,
        other_user: { id: 'them', first_name: null, last_name: null, avatar_url: null },
      })}
    />,
  )
  expect(screen.getByText('No messages yet')).toBeInTheDocument()
  expect(screen.getByText('Anonymous')).toBeInTheDocument()
})
