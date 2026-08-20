/**
 * The send half of the chat store: the optimistic copy, the temp-id swap, the
 * WS-echo race, retry, and what happens when the swap itself fails (#72).
 *
 * Split from chat.store.test.ts when #72's cases took the one file past the
 * house limit — the same split mobile made in #59, and for the same reasons.
 *
 * The race is why this half is its own file: `sendMessage` appends a `temp_…`
 * copy, POSTs, then replaces that copy with the server row — but the server
 * also broadcasts the message back, and the broadcast can arrive first. Both
 * orders have to end with exactly one message.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Conversation, Message } from '@tenda/shared'

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
import { makeMessage as msg } from '../../test/factories/chat'

beforeEach(() => {
  vi.clearAllMocks()
  // The store's OWN reset, not a hand-listed subset: the old three-field
  // version left `conversationsStatus` to leak between cases, which stayed
  // invisible only while every fetch overwrote it unconditionally.
  useChatStore.getState().reset()
  useAuthStore.setState({ user: makeUser({ id: 'me' }) })
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

  /**
   * Retry re-sends the ATTACHMENT too, which the store's own docstring
   * promises ("retry re-sends the already-uploaded attachment") and which no
   * test reached until #53 — the only place in either client that rebuilds an
   * UploadedAttachment from the three wire columns rather than from a fresh
   * upload. A regression here would silently drop the image the reader
   * attached and re-send the text alone.
   */
  it('retry re-sends an already-uploaded attachment, url/type/size intact', async () => {
    conversationsApi.sendMessage.mockRejectedValueOnce(new Error('offline'))
    await useChatStore.getState().sendMessage('c1', 'see this', undefined, {
      url: 'https://res.cloudinary.com/demo/image/upload/v1/chat/a.png',
      type: 'image',
      size: 2048,
    })
    const failed = useChatStore.getState().messages.c1[0]
    expect(failed._status).toBe('failed')

    conversationsApi.sendMessage.mockResolvedValue(
      msg({ id: 'srv-5', sender_id: 'me', content: 'see this' }),
    )
    useChatStore.getState().retryMessage('c1', failed)
    await vi.waitFor(() => {
      expect(useChatStore.getState().messages.c1.map((m) => m.id)).toEqual(['srv-5'])
    })
    expect(conversationsApi.sendMessage).toHaveBeenLastCalledWith(
      { id: 'c1' },
      expect.objectContaining({
        content: 'see this',
        attachment_url: 'https://res.cloudinary.com/demo/image/upload/v1/chat/a.png',
        attachment_type: 'image',
        attachment_size: 2048,
      }),
    )
  })

  it('retry sends NO attachment when the columns are only partly set', async () => {
    // The three are nullable AS A GROUP on the wire. A row carrying a url but
    // no size is not half an attachment to re-send — it is a row the server
    // would reject, so the retry must go out as plain text rather than
    // assembling something out of what happens to be present.
    const partial = {
      ...msg({ id: 'temp_1', sender_id: 'me', content: 'partial' }),
      attachment_url: 'https://res.cloudinary.com/demo/image/upload/v1/chat/b.png',
      attachment_type: 'image' as const,
      attachment_size: null,
      _status: 'failed' as const,
    }
    useChatStore.setState({ messages: { c1: [partial] } })

    conversationsApi.sendMessage.mockResolvedValue(
      msg({ id: 'srv-6', sender_id: 'me', content: 'partial' }),
    )
    useChatStore.getState().retryMessage('c1', partial)
    await vi.waitFor(() => {
      expect(useChatStore.getState().messages.c1.map((m) => m.id)).toEqual(['srv-6'])
    })
    // The exact key set, not three `not.toHaveProperty` checks: those read
    // off `lastCall ?? []`, so an `undefined` body — no call at all — passed
    // all three.
    const [, body] = conversationsApi.sendMessage.mock.lastCall ?? []
    expect(Object.keys(body ?? {}).sort()).toEqual(['content', 'escrow_id'])
  })
})

describe('a send whose store update fails (#72)', () => {
  // The bug these pin: the try used to wrap the swap as well as the request, so
  // anything the swap threw landed in the failure handler. The message was on
  // the server, the thread showed it failed, and the Retry beside it sent a
  // SECOND copy — a silent duplicate reported as a network error. Mobile had
  // the identical shape and is fixed in the same change.
  //
  // The lever is a 200 whose body is not a message: nothing validates the
  // response, so `sent.id` inside the swap throws on it. Parsed rather than
  // cast, because the mock is typed to the route's real return and this is
  // exactly what `api/request.ts` hands back — `await response.json()`.
  const malformedResponse = (): Message => JSON.parse('null')

  it('is not reported as a failed send', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    conversationsApi.sendMessage.mockResolvedValue(malformedResponse())

    await useChatStore.getState().sendMessage('c1', 'hi')

    const sent = useChatStore.getState().messages.c1
    expect(sent).toHaveLength(1)
    // NOT 'failed' — a failed row offers Retry, and the server already has it.
    expect(sent?.[0]._status).toBe('sending')
    expect(warn).toHaveBeenCalled()
    warn.mockRestore()
  })

  it('and still does not reject — every caller is `void sendMessage(...)`', async () => {
    // Narrowing the catch could have let the throw escape instead. All three
    // call sites fire and forget, so an escaping rejection would surface as an
    // unhandled one rather than reaching anybody who could act on it.
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    conversationsApi.sendMessage.mockResolvedValue(malformedResponse())

    await expect(useChatStore.getState().sendMessage('c1', 'hi')).resolves.toBeUndefined()

    warn.mockRestore()
  })
})
