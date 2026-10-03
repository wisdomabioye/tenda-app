import { create } from 'zustand'
import { api } from '@/api/client'
import { useAuthStore } from '@/stores/auth.store'
import {
  accountGeneration,
  ATTACHMENT_PREVIEW,
  INBOX_PAGE_SIZE,
  isSameAccount,
  mergeById,
  registerAccountReset,
  type Conversation,
  type Message,
  type UploadedAttachment,
} from '@tenda/shared'

// A message optimistically added before server confirmation
export type LocalMessage = Message & {
  _status?: 'sending' | 'sent' | 'failed'
}

/** The escrow (gig/exchange) a message is contextually attached to. */
export interface EscrowContext {
  escrowId: string
  kind: 'gig' | 'exchange' | null
}

interface ChatState {
  conversations:    Conversation[]
  messages:         Record<string, LocalMessage[]>   // conversationId → messages (oldest first)
  unread:           number                           // total unread across the LOADED conversations
  /** False once a page came back short: nothing older is left to ask for. */
  hasMoreConversations:     boolean
  loadingMoreConversations: boolean

  /** Refresh the newest page. Pages already scrolled to are KEPT (see below). */
  fetchConversations: () => Promise<void>
  /** The next older page, after the last conversation held. */
  loadMoreConversations: () => Promise<void>
  findOrCreate:       (userId: string) => Promise<Conversation>
  fetchMessages:      (conversationId: string, beforeId?: string) => Promise<Message[]>
  sendMessage:        (conversationId: string, content: string, context?: EscrowContext, attachment?: UploadedAttachment) => Promise<void>
  retryMessage:       (conversationId: string, message: LocalMessage) => void
  closeConversation:  (conversationId: string) => Promise<void>
  appendMessage:      (conversationId: string, message: LocalMessage) => void
  receiveMessage:     (conversationId: string, message: Message) => void
  /** Back to empty — every field in `INITIAL`, which is what the store
   *  spreads, so a field added there is reset for free. One added directly in
   *  the store body below is NOT, which is the one way to get this wrong. */
  reset:              () => void
}

/** The store as the module defines it — the single source for `reset`. */
const INITIAL = {
  conversations: [] as Conversation[],
  messages:      {} as Record<string, LocalMessage[]>,
  unread:        0,
  // Optimistic: one load decides it. A fresh store has loaded nothing, so there
  // is no page that came back short.
  hasMoreConversations:     true,
  loadingMoreConversations: false,
}

const totalUnread = (list: readonly Conversation[]): number => list.reduce((sum, c) => sum + c.unread_count, 0)

/**
 * The list after a refresh of its newest page: the fresh page, then whatever the
 * client had scrolled to BEYOND it.
 *
 * Refreshes are frequent (focus, the poll, every realtime frame), so replacing
 * the list would throw away the older pages a user had just loaded and snap the
 * scroll back. The tail is found by the page's own last row: everything held
 * AFTER it is older than the page and still valid; everything before it is
 * covered by the page itself, so a row the page no longer lists (closed since)
 * is correctly gone. If that last row was never held, nothing can be said about
 * how the old list lines up with the new page, so it starts over from the page.
 */
function refreshFirstPage(held: readonly Conversation[], page: readonly Conversation[]): Conversation[] {
  // A short page IS the whole list: nothing older exists, so anything held
  // beyond it is a conversation that has since closed.
  if (page.length < INBOX_PAGE_SIZE) return [...page]
  const last = page[page.length - 1]
  const at = held.findIndex((c) => c.id === last?.id)
  if (at === -1) return [...page]
  const onPage = new Set(page.map((c) => c.id))
  return [...page, ...held.slice(at + 1).filter((c) => !onPage.has(c.id))]
}

export const useChatStore = create<ChatState>((set, get) => ({
  ...INITIAL,

  reset: () => set({ ...INITIAL }),

  fetchConversations: async () => {
    // Snapshot BEFORE the await. Emptying the store is a moment; this request
    // is already on its way and would otherwise write the previous account's
    // threads — and their unread badge — back in after the clear (#65).
    const gen = accountGeneration()
    const page = await api.conversations.list({ limit: INBOX_PAGE_SIZE })
    if (!isSameAccount(gen)) return
    set((s) => {
      const conversations = refreshFirstPage(s.conversations, page)
      // A kept tail means older pages are loaded, and whether MORE remain is
      // what the last load of the tail said — not something the newest page
      // can know. Only a list that is just this page decides for itself.
      const hasMore = conversations.length > page.length ? s.hasMoreConversations : page.length === INBOX_PAGE_SIZE
      return { conversations, unread: totalUnread(conversations), hasMoreConversations: hasMore }
    })
  },

  loadMoreConversations: async () => {
    const { conversations, hasMoreConversations, loadingMoreConversations } = get()
    const last = conversations[conversations.length - 1]
    if (!hasMoreConversations || loadingMoreConversations || last === undefined) return

    const gen = accountGeneration()
    set({ loadingMoreConversations: true })
    try {
      const page = await api.conversations.list({ before_id: last.id, limit: INBOX_PAGE_SIZE })
      if (!isSameAccount(gen)) return
      set((s) => {
        // The page continues from `last`. If the list moved under the request (a
        // refresh dropped the tail, a thread was closed) it no longer ends there,
        // and appending would leave a gap that no later page can ever fill.
        // Drop it; the next scroll asks again from wherever the list ends now.
        if (s.conversations[s.conversations.length - 1]?.id !== last.id) return { loadingMoreConversations: false }
        const merged = mergeById(s.conversations, page, (c) => c.id)
        return {
          conversations: merged,
          unread: totalUnread(merged),
          hasMoreConversations: page.length === INBOX_PAGE_SIZE,
          loadingMoreConversations: false,
        }
      })
    } catch {
      // A failed page leaves the list as it was and `hasMore` untouched, so the
      // next scroll to the end simply asks again — the notification feed's rule,
      // and the reason this never rejects into an `onEndReached` handler.
      if (isSameAccount(gen)) set({ loadingMoreConversations: false })
    }
  },

  findOrCreate: async (userId) => {
    const gen = accountGeneration()
    const conv = await api.conversations.findOrCreate({ user_id: userId })
    // The caller still gets its conversation — the screen that asked is gone
    // either way — but it must not be filed into the next account's inbox.
    if (!isSameAccount(gen)) return conv
    set((s) => {
      const exists = s.conversations.find((c) => c.id === conv.id)
      return {
        conversations: exists
          ? s.conversations.map((c) => (c.id === conv.id ? conv : c))
          : [conv, ...s.conversations],
      }
    })
    return conv
  },

  fetchMessages: async (conversationId, beforeId) => {
    const gen = accountGeneration()
    const fetched = await api.conversations.messages({ id: conversationId }, beforeId ? { before_id: beforeId } : undefined)
    // The message bodies: the one write here that would put another account's
    // private content on screen. The caller still gets its rows.
    if (!isSameAccount(gen)) return fetched
    // Server returns newest-first; reverse for display (oldest first)
    const ordered = [...fetched].reverse()

    set((s) => {
      const existing = s.messages[conversationId] ?? []
      if (beforeId) {
        // Prepend older messages
        return { messages: { ...s.messages, [conversationId]: [...ordered, ...existing] } }
      }
      // Merge: preserve optimistic messages that aren't yet server-confirmed
      const optimistic = existing.filter((m) => m._status === 'sending')
      // Mark this conversation as read locally so the unread badge clears immediately
      // (the server marks messages read asynchronously on the same request)
      const conversations = s.conversations.map((c) =>
        c.id === conversationId ? { ...c, unread_count: 0 } : c
      )
      const unread = conversations.reduce((sum, c) => sum + c.unread_count, 0)
      return {
        messages:      { ...s.messages, [conversationId]: [...ordered, ...optimistic] },
        conversations,
        unread,
      }
    })

    return fetched
  },

  sendMessage: async (conversationId, content, context, attachment) => {
    const tempId = `temp_${Date.now()}`
    const optimistic: LocalMessage = {
      id:              tempId,
      conversation_id: conversationId,
      sender_id:       useAuthStore.getState().user?.id ?? '',
      escrow_id:       context?.escrowId ?? null,
      escrow_title:    null,
      escrow_kind:     context?.kind ?? null,
      content,
      attachment_url:  attachment?.url  ?? null,
      attachment_type: attachment?.type ?? null,
      attachment_size: attachment?.size ?? null,
      read_at:         null,
      created_at:      new Date().toISOString(),
      _status:         'sending',
    }
    get().appendMessage(conversationId, optimistic)

    const gen = accountGeneration()
    // The try wraps the REQUEST and nothing else (#72). It used to wrap the
    // swap below as well, so anything that handler threw was caught by the
    // failure handler: the message was on the server, the thread showed it as
    // failed, and the Retry beside it sent a second copy the server already
    // had. A silent duplicate reported as a network error.
    let sent: Message
    try {
      sent = await api.conversations.sendMessage(
        { id: conversationId },
        {
          content,
          escrow_id: context?.escrowId,
          ...(attachment !== undefined
            ? { attachment_url: attachment.url, attachment_type: attachment.type, attachment_size: attachment.size }
            : {}),
        },
      )
    } catch {
      // The send did not reach the server. Marking it failed is still a write
      // into the thread list, so it is account-guarded like every other.
      if (isSameAccount(gen)) {
        set((s) => ({
          messages: {
            ...s.messages,
            [conversationId]: (s.messages[conversationId] ?? []).map((m) =>
              m.id === tempId ? { ...m, _status: 'failed' as const } : m,
            ),
          },
        }))
      }
      return
    }

    if (!isSameAccount(gen)) return
    try {
      set((s) => {
        const existing = s.messages[conversationId] ?? []
        // The WS echo of our own message may land before this response,
        // if the server id is already present, just drop the temp copy.
        const updated = existing.some((m) => m.id === sent.id)
          ? existing.filter((m) => m.id !== tempId)
          : existing.map((m) => (m.id === tempId ? { ...sent, _status: 'sent' as const } : m))
        return { messages: { ...s.messages, [conversationId]: updated } }
      })
    } catch (e) {
      // Contained, but NOT as a failed send: the server has the message, so the
      // one thing this must never do is offer a Retry that duplicates it. The
      // optimistic copy stays 'sending' — honest, since we could not reconcile
      // it — and the warn is what tells a developer the handler broke.
      //
      // Contained HERE rather than left to propagate because all three callers
      // are `void sendMessage(...)`: a rejection would surface as an unhandled
      // one rather than reaching anybody who could act on it.
      console.warn('[chat] send succeeded but the store update failed:', e)
    }
  },

  retryMessage: (conversationId, message) => {
    // Remove the failed optimistic message then re-send its content (and
    // any already-uploaded attachment, the Cloudinary URL stays valid).
    set((s) => ({
      messages: {
        ...s.messages,
        [conversationId]: (s.messages[conversationId] ?? []).filter((m) => m.id !== message.id),
      },
    }))
    const attachment =
      message.attachment_url !== null && message.attachment_type !== null && message.attachment_size !== null
        ? { url: message.attachment_url, type: message.attachment_type, size: message.attachment_size }
        : undefined
    void get().sendMessage(
      conversationId,
      message.content,
      message.escrow_id !== null ? { escrowId: message.escrow_id, kind: message.escrow_kind } : undefined,
      attachment,
    )
  },

  // No generation guard, unlike every other async writer here: this one only
  // REMOVES a row by id, and a conversation uuid belonging to the previous
  // account cannot match anything in the next account's list. The write is a
  // no-op after a switch rather than a leak (#65).
  closeConversation: async (conversationId) => {
    await api.conversations.close({ id: conversationId })
    set((s) => ({
      conversations: s.conversations.filter((c) => c.id !== conversationId),
    }))
  },

  appendMessage: (conversationId, message) => {
    set((s) => ({
      messages: {
        ...s.messages,
        [conversationId]: [...(s.messages[conversationId] ?? []), message],
      },
    }))
  },

  // WS delivery, dedupes by id (the broadcast echoes the sender's own
  // message back, and a reconnect-era fetchMessages may already have it).
  receiveMessage: (conversationId, message) => {
    set((s) => {
      const existing = s.messages[conversationId] ?? []
      if (existing.some((m) => m.id === message.id)) return s

      const isOwn = message.sender_id === useAuthStore.getState().user?.id
      const conversations = s.conversations.map((c) =>
        c.id === conversationId
          ? {
              ...c,
              last_message:    message.content.length > 0 ? message.content : ATTACHMENT_PREVIEW,
              last_message_at: message.created_at,
            }
          : c,
      )
      return {
        messages: {
          ...s.messages,
          [conversationId]: [...existing, isOwn ? { ...message, _status: 'sent' as const } : message],
        },
        conversations,
      }
    })
  },
}))

// Private threads, their bodies and the unread badge: nothing here may outlive
// the account that fetched it. Registered beside the state rather than listed
// inside `logout`, because the list-in-logout is what left three stores out on
// web (#25) — and mobile's copy of that list named only `notifications`, so
// chat, gigs and escrow were never in it at all (#65).
registerAccountReset(() => useChatStore.getState().reset())
