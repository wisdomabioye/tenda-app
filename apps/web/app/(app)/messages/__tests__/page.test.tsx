/**
 * Inbox page: Unread/Earlier sectioning, the empty state, and the error
 * state with a working retry.
 */
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, expect, test, vi } from 'vitest'
import MessagesPage from '../page'
import { useChatStore } from '@/stores/chat.store'
import { makeConversation } from '../../../../test/factories/chat'

const fetchConversations = vi.fn<() => Promise<void>>()

beforeEach(() => {
  vi.clearAllMocks()
  fetchConversations.mockResolvedValue()
  useChatStore.setState({ conversations: [], unread: 0, fetchConversations })
})

test('sections unread above earlier and counts unread threads in the header', () => {
  useChatStore.setState({
    conversations: [
      makeConversation({ id: 'c1', unread_count: 2 }),
      makeConversation({
        id: 'c2',
        other_user: { id: 'u2', first_name: 'Bola', last_name: 'Ade', avatar_url: null },
      }),
    ],
  })
  render(<MessagesPage />)
  expect(screen.getByText('Unread')).toBeInTheDocument()
  expect(screen.getByText('Earlier')).toBeInTheDocument()
  expect(screen.getByText('1 unread thread')).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Open chat with Ada Okafor' })).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Open chat with Bola Ade' })).toBeInTheDocument()
})

test('empty inbox shows the empty state, not the section headers', () => {
  render(<MessagesPage />)
  expect(screen.getByText('No conversations yet')).toBeInTheDocument()
  expect(screen.queryByText('Unread')).toBeNull()
  expect(fetchConversations).toHaveBeenCalledTimes(1) // mount refresh
})

test('a failing load shows the error state and Retry refetches', async () => {
  fetchConversations.mockRejectedValueOnce(new Error('down')).mockResolvedValue()
  render(<MessagesPage />)
  expect(await screen.findByText("Couldn't load messages")).toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: 'Retry' }))
  expect(fetchConversations).toHaveBeenCalledTimes(2)
})
