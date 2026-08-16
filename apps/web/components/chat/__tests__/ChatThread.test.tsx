/**
 * Thread screen wiring: bootstrap states (loading/error/retry), the feed
 * with day headers + dividers, sending through the store with the escrow
 * context, the close-conversation menu flow, and attachment click routing
 * (image → lightbox, PDF → new tab).
 */
import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, expect, test, vi } from 'vitest'
import type { PublicUser } from '@tenda/shared'

const routerPush = vi.hoisted(() => vi.fn())
const conversationState = vi.hoisted(() => ({
  current: {
    conversationId: 'c1' as string | null,
    otherUser: null as PublicUser | null,
    loading: false,
    initError: false,
    retry: () => {},
  },
}))

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: routerPush, back: vi.fn(), replace: vi.fn() }),
}))
vi.mock('@/components/chat/useConversation', () => ({
  useConversation: () => conversationState.current,
}))
vi.mock('@/components/chat/useChatRealtime', () => ({ useChatRealtime: () => {} }))
vi.mock('@/hooks/uploads/useAttachmentUpload', () => ({
  useAttachmentUpload: () => ({ uploading: false, upload: vi.fn() }),
}))

import { ChatThread } from '@/components/chat/ChatThread'
import { useChatStore } from '@/stores/chat.store'
import { useAuthStore } from '@/stores/auth.store'
import { makePublicUser, makeUser } from '../../../test/factories/user'
import { makeMessage } from '../../../test/factories/chat'

const sendMessage = vi.fn<() => Promise<void>>()
const closeConversation = vi.fn<() => Promise<void>>()


beforeEach(() => {
  vi.clearAllMocks()
  sendMessage.mockResolvedValue()
  closeConversation.mockResolvedValue()
  conversationState.current = {
    conversationId: 'c1',
    otherUser: makePublicUser(),
    loading: false,
    initError: false,
    retry: vi.fn(),
  }
  useAuthStore.setState({ user: makeUser({ id: 'me' }) })
  useChatStore.setState({
    sendMessage,
    closeConversation,
    messages: {
      c1: [
        makeMessage({ id: 'm1', content: 'first', escrow_id: 'e1', escrow_title: 'Paint', escrow_kind: 'gig' }),
        makeMessage({ id: 'm2', content: 'second', sender_id: 'me' }),
      ],
    },
  })
})

test('renders the feed with day header, context divider and both bubbles', () => {
  render(<ChatThread userId="them" />)
  expect(screen.getByText('Ada Okafor')).toBeInTheDocument()
  expect(screen.getByText('first')).toBeInTheDocument()
  expect(screen.getByText('second')).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Open gig: Paint' })).toBeInTheDocument()
  expect(screen.getByText('DIRECT MESSAGE')).toBeInTheDocument() // m2 dropped back to DM
})

test('sending routes through the store with the escrow context from the URL', async () => {
  render(
    <ChatThread
      userId="them"
      context={{ escrowId: 'e9', escrowTitle: 'Fix sink', kind: 'gig' }}
    />,
  )
  await userEvent.type(screen.getByPlaceholderText('Message…'), 'hello')
  await userEvent.keyboard('{Enter}')
  expect(sendMessage).toHaveBeenCalledWith('c1', 'hello', { escrowId: 'e9', kind: 'gig' })
})

test('close conversation: menu → confirm → store call → back to the inbox', async () => {
  render(<ChatThread userId="them" />)
  await userEvent.click(screen.getByRole('button', { name: 'More options' }))
  await userEvent.click(screen.getByRole('button', { name: /Close conversation/ }))
  await userEvent.click(screen.getByRole('button', { name: 'Close' }))
  expect(closeConversation).toHaveBeenCalledWith('c1')
  await vi.waitFor(() => expect(routerPush).toHaveBeenCalledWith('/messages'))
})

test('image attachments open the lightbox; PDFs open a new tab', async () => {
  useChatStore.setState({
    messages: {
      c1: [
        makeMessage({ id: 'a1', content: '', attachment_url: 'https://cdn/x.png', attachment_type: 'image', attachment_size: 1 }),
        makeMessage({ id: 'a2', content: '', attachment_url: 'https://cdn/d.pdf', attachment_type: 'file', attachment_size: 1 }),
      ],
    },
  })
  const openSpy = vi.spyOn(window, 'open').mockReturnValue(null)
  render(<ChatThread userId="them" />)

  await userEvent.click(screen.getByRole('button', { name: 'View image attachment' }))
  expect(screen.getByRole('button', { name: 'Close viewer' })).toBeInTheDocument()

  await userEvent.click(screen.getByRole('button', { name: 'Open document attachment' }))
  expect(openSpy).toHaveBeenCalledWith('https://cdn/d.pdf', '_blank', 'noopener')
  openSpy.mockRestore()
})

test('bootstrap error shows the retry surface and loading shows neither', () => {
  conversationState.current = { ...conversationState.current, initError: true, conversationId: null }
  const { unmount } = render(<ChatThread userId="them" />)
  expect(screen.getByText("Couldn't open chat")).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Retry' }))
  expect(conversationState.current.retry).toHaveBeenCalled()
  unmount()

  conversationState.current = { ...conversationState.current, initError: false, loading: true }
  render(<ChatThread userId="them" />)
  expect(screen.queryByText("Couldn't open chat")).toBeNull()
  expect(screen.queryByPlaceholderText('Message…')).toBeNull()
})
