/**
 * Chat store behavior — optimistic send lifecycle, WS-echo dedupe, unread
 * accounting, close/reopen list handling. The api client is mocked at its
 * seam; assertions pin the exact wire bodies (drift here breaks mobile
 * parity silently).
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ATTACHMENT_PREVIEW, type Conversation, type Message } from '@tenda/shared'

const conversationsApi = vi.hoisted(() => ({
  list: vi.fn<() => Promise<Conversation[]>>(),
  findOrCreate: vi.fn<(body: { user_id: string }) => Promise<Conversation>>(),
  messages: vi.fn<(p: { id: string }, q?: { before_id: string }) => Promise<Message[]>>(),
  sendMessage: vi.fn<(p: { id: string }, body: Record<string, unknown>) => Promise<Message>>(),
  close: vi.fn(),
}))

vi.mock('@/api/client', () => ({ api: { conversations: conversationsApi } }))

import { useChatStore } from '@/stores/chat.store'
import { useAuthStore } from '@/stores/auth.store'
import { makeUser } from '../../test/factories/user'
import { makeConversation as conv, makeMessage as msg } from '../../test/factories/chat'



beforeEach(() => {
  vi.clearAllMocks()
  // The store's OWN reset, not a hand-listed subset: the old three-field
  // version left `conversationsStatus` to leak between cases, which stayed
  // invisible only while every fetch overwrote it unconditionally.
  useChatStore.getState().reset()
  useAuthStore.setState({ user: makeUser({ id: 'me' }) })
})

describe('conversations', () => {
  it('fetchConversations stores the list and sums unread across threads', async () => {
    conversationsApi.list.mockResolvedValue([
      conv({ id: 'c1', unread_count: 2 }),
      conv({ id: 'c2', unread_count: 3 }),
    ])
    await useChatStore.getState().fetchConversations()
    expect(useChatStore.getState().unread).toBe(5)
  })

  it('findOrCreate prepends a NEW conversation and replaces a known one in place', async () => {
    conversationsApi.findOrCreate.mockResolvedValue(conv({ id: 'c9' }))
    await useChatStore.getState().findOrCreate('them')
    expect(useChatStore.getState().conversations.map((c) => c.id)).toEqual(['c9'])

    conversationsApi.findOrCreate.mockResolvedValue(conv({ id: 'c9', last_message: 'reopened' }))
    await useChatStore.getState().findOrCreate('them')
    const list = useChatStore.getState().conversations
    expect(list).toHaveLength(1)
    expect(list[0].last_message).toBe('reopened')
  })

  it('closeConversation removes the thread from the inbox', async () => {
    useChatStore.setState({ conversations: [conv({ id: 'c1' }), conv({ id: 'c2' })] })
    conversationsApi.close.mockResolvedValue(conv({ id: 'c1', status: 'closed' }))
    await useChatStore.getState().closeConversation('c1')
    expect(conversationsApi.close).toHaveBeenCalledWith({ id: 'c1' })
    expect(useChatStore.getState().conversations.map((c) => c.id)).toEqual(['c2'])
  })
})

describe('fetchMessages', () => {
  it('reverses the newest-first wire order, keeps pending optimistic copies, clears unread locally', async () => {
    useChatStore.setState({
      conversations: [conv({ id: 'c1', unread_count: 4 }), conv({ id: 'c2', unread_count: 1 })],
      unread: 5,
      messages: { c1: [{ ...msg({ id: 'temp_1', sender_id: 'me' }), _status: 'sending' }] },
    })
    conversationsApi.messages.mockResolvedValue([msg({ id: 'm2' }), msg({ id: 'm1' })])

    await useChatStore.getState().fetchMessages('c1')

    const s = useChatStore.getState()
    expect(s.messages.c1.map((m) => m.id)).toEqual(['m1', 'm2', 'temp_1'])
    expect(s.conversations.find((c) => c.id === 'c1')?.unread_count).toBe(0)
    expect(s.unread).toBe(1) // c2 untouched
  })

  it('a before_id page PREPENDS older messages without touching unread', async () => {
    useChatStore.setState({ messages: { c1: [msg({ id: 'm3' })] } })
    conversationsApi.messages.mockResolvedValue([msg({ id: 'm2' }), msg({ id: 'm1' })])
    await useChatStore.getState().fetchMessages('c1', 'm3')
    expect(conversationsApi.messages).toHaveBeenCalledWith({ id: 'c1' }, { before_id: 'm3' })
    expect(useChatStore.getState().messages.c1.map((m) => m.id)).toEqual(['m1', 'm2', 'm3'])
  })
})

describe('sendMessage lifecycle', () => {
  it('appends an optimistic copy then swaps in the server message with its exact wire body', async () => {
    conversationsApi.sendMessage.mockResolvedValue(msg({ id: 'srv-1', sender_id: 'me', content: 'yo' }))
    await useChatStore.getState().sendMessage('c1', 'yo', { escrowId: 'e1', kind: 'gig' }, {
      url: 'https://cdn/x.png',
      type: 'image',
      size: 123,
    })
    expect(conversationsApi.sendMessage).toHaveBeenCalledWith(
      { id: 'c1' },
      {
        content: 'yo',
        escrow_id: 'e1',
        attachment_url: 'https://cdn/x.png',
        attachment_type: 'image',
        attachment_size: 123,
      },
    )
    const msgs = useChatStore.getState().messages.c1
    expect(msgs).toHaveLength(1)
    expect(msgs[0]).toMatchObject({ id: 'srv-1', _status: 'sent' })
  })

  it('omits attachment fields entirely when sending text only', async () => {
    conversationsApi.sendMessage.mockResolvedValue(msg({ id: 'srv-2', sender_id: 'me' }))
    await useChatStore.getState().sendMessage('c1', 'plain')
    expect(conversationsApi.sendMessage).toHaveBeenCalledWith(
      { id: 'c1' },
      { content: 'plain', escrow_id: undefined },
    )
  })

  it('drops the temp copy when the WS echo landed first (id already present)', async () => {
    let resolveSend: ((m: Message) => void) | undefined
    conversationsApi.sendMessage.mockReturnValue(new Promise((r) => { resolveSend = r }))
    const pending = useChatStore.getState().sendMessage('c1', 'raced')
    // WS echo arrives before the POST response:
    useChatStore.getState().receiveMessage('c1', msg({ id: 'srv-3', sender_id: 'me', content: 'raced' }))
    resolveSend?.(msg({ id: 'srv-3', sender_id: 'me', content: 'raced' }))
    await pending
    const msgs = useChatStore.getState().messages.c1
    expect(msgs.map((m) => m.id)).toEqual(['srv-3'])
  })

  it('marks the optimistic copy failed when the POST rejects, and retry re-sends it', async () => {
    conversationsApi.sendMessage.mockRejectedValueOnce(new Error('offline'))
    await useChatStore.getState().sendMessage('c1', 'oops', { escrowId: 'e1', kind: 'gig' })
    const failed = useChatStore.getState().messages.c1[0]
    expect(failed._status).toBe('failed')

    conversationsApi.sendMessage.mockResolvedValue(msg({ id: 'srv-4', sender_id: 'me', content: 'oops' }))
    useChatStore.getState().retryMessage('c1', failed)
    await vi.waitFor(() => {
      expect(useChatStore.getState().messages.c1.map((m) => m.id)).toEqual(['srv-4'])
    })
    // Context survived the retry:
    expect(conversationsApi.sendMessage).toHaveBeenLastCalledWith(
      { id: 'c1' },
      expect.objectContaining({ content: 'oops', escrow_id: 'e1' }),
    )
  })
})

describe('receiveMessage (WS delivery)', () => {
  it('dedupes by id and updates the conversation preview', () => {
    useChatStore.setState({ conversations: [conv({ id: 'c1' })] })
    const incoming = msg({ id: 'ws-1', content: 'new text', created_at: '2026-08-16T09:00:00.000Z' })
    useChatStore.getState().receiveMessage('c1', incoming)
    useChatStore.getState().receiveMessage('c1', incoming)
    const s = useChatStore.getState()
    expect(s.messages.c1).toHaveLength(1)
    expect(s.conversations[0].last_message).toBe('new text')
    expect(s.conversations[0].last_message_at).toBe('2026-08-16T09:00:00.000Z')
  })

  it('an attachment-only echo previews as the attachment placeholder and my own echo reads as sent', () => {
    useChatStore.setState({ conversations: [conv({ id: 'c1' })] })
    useChatStore.getState().receiveMessage('c1', msg({ id: 'ws-2', sender_id: 'me', content: '' }))
    const s = useChatStore.getState()
    expect(s.conversations[0].last_message).toBe(ATTACHMENT_PREVIEW)
    expect(s.messages.c1[0]._status).toBe('sent')
  })
})

describe('the fallback poll over a settled inbox (#26)', () => {
  it('does not re-raise the skeleton on an inbox that is legitimately EMPTY', async () => {
    // The column shows a skeleton when the status is 'loading' AND it has no
    // rows — a guard that works for a populated list and fails for an empty
    // one, which is the commonest new account. With the socket down the
    // fallback poll runs every 15s, so an account with no messages watched its
    // "No messages yet" flip to a skeleton and back, for as long as it stayed
    // on the surface. chain-registry.store already had the rule ("never flash
    // a skeleton over a registry already serving good data"); the inbox did
    // not.
    conversationsApi.list.mockResolvedValue([])
    await useChatStore.getState().fetchConversations()
    expect(useChatStore.getState().conversationsStatus).toBe('ready')

    let release!: (rows: Conversation[]) => void
    conversationsApi.list.mockReturnValue(new Promise((r) => { release = r }))
    const polling = useChatStore.getState().fetchConversations()

    expect(useChatStore.getState().conversationsStatus).toBe('ready')

    release([])
    await polling
  })

  it('a failed poll does not turn a SETTLED empty inbox into an error', async () => {
    // Same doctrine as the skeleton above, and the column states it outright:
    // "a failed poll behind a populated list is not worth taking the list
    // away". Once the inbox has answered "none", one transient poll failure
    // must not replace that true statement with "Could not load your
    // messages" — the column shows the error whenever the status is 'error'
    // and it holds no rows, which a genuinely empty inbox always does.
    conversationsApi.list.mockResolvedValue([])
    await useChatStore.getState().fetchConversations()
    expect(useChatStore.getState().conversationsStatus).toBe('ready')

    conversationsApi.list.mockRejectedValue(new Error('poll failed'))
    await expect(useChatStore.getState().fetchConversations()).rejects.toThrow()

    expect(useChatStore.getState().conversationsStatus).toBe('ready')
  })

  it('a first load that FAILS is still an error — there is nothing settled to keep', async () => {
    conversationsApi.list.mockRejectedValue(new Error('down'))
    await expect(useChatStore.getState().fetchConversations()).rejects.toThrow()
    expect(useChatStore.getState().conversationsStatus).toBe('error')
  })

  it('DOES raise it on the first load, when there is nothing to show yet', async () => {
    // The other half: a first load with no data must still show the skeleton,
    // or the surface renders its empty state before anyone has asked.
    let release!: (rows: Conversation[]) => void
    conversationsApi.list.mockReturnValue(new Promise((r) => { release = r }))
    const first = useChatStore.getState().fetchConversations()

    expect(useChatStore.getState().conversationsStatus).toBe('loading')

    release([])
    await first
  })

  it('raises it again after an ERROR, so a retry is visible', async () => {
    conversationsApi.list.mockRejectedValue(new Error('down'))
    await expect(useChatStore.getState().fetchConversations()).rejects.toThrow()
    expect(useChatStore.getState().conversationsStatus).toBe('error')

    let release!: (rows: Conversation[]) => void
    conversationsApi.list.mockReturnValue(new Promise((r) => { release = r }))
    const retry = useChatStore.getState().fetchConversations()

    expect(useChatStore.getState().conversationsStatus).toBe('loading')

    release([])
    await retry
  })
})
