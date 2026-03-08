import { create } from 'zustand'
import { api } from '@/api/client'
import { useAuthStore } from '@/stores/auth.store'
import type { Conversation, Message } from '@tenda/shared'

// A message optimistically added before server confirmation
export type LocalMessage = Message & {
  _status?: 'sending' | 'sent' | 'failed'
}

interface ChatState {
  conversations:    Conversation[]
  messages:         Record<string, LocalMessage[]>   // conversationId → messages (oldest first)
  unread:           number                           // total unread across all conversations

  fetchConversations: () => Promise<void>
  findOrCreate:       (userId: string) => Promise<Conversation>
  fetchMessages:      (conversationId: string, beforeId?: string) => Promise<Message[]>
  sendMessage:        (conversationId: string, content: string, gigId?: string) => Promise<void>
  retryMessage:       (conversationId: string, message: LocalMessage) => void
  closeConversation:  (conversationId: string) => Promise<void>
  appendMessage:      (conversationId: string, message: LocalMessage) => void
}

export const useChatStore = create<ChatState>((set, get) => ({
  conversations: [],
  messages:      {},
  unread:        0,

  fetchConversations: async () => {
    const convs = await api.conversations.list()
    const unread = convs.reduce((sum, c) => sum + c.unread_count, 0)
    set({ conversations: convs, unread })
  },

  findOrCreate: async (userId) => {
    const conv = await api.conversations.findOrCreate({ user_id: userId })
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
    const fetched = await api.conversations.messages({ id: conversationId }, beforeId ? { before_id: beforeId } : undefined)
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

  sendMessage: async (conversationId, content, gigId) => {
    const tempId = `temp_${Date.now()}`
    const optimistic: LocalMessage = {
      id:              tempId,
      conversation_id: conversationId,
      sender_id:       useAuthStore.getState().user?.id ?? '',
      gig_id:          gigId ?? null,
      gig_title:       null,
      content,
      read_at:         null,
      created_at:      new Date().toISOString(),
      _status:         'sending',
    }
    get().appendMessage(conversationId, optimistic)

    try {
      const sent = await api.conversations.sendMessage({ id: conversationId }, { content, gig_id: gigId })
      set((s) => ({
        messages: {
          ...s.messages,
          [conversationId]: (s.messages[conversationId] ?? []).map((m) =>
            m.id === tempId ? { ...sent, _status: 'sent' as const } : m,
          ),
        },
      }))
    } catch {
      set((s) => ({
        messages: {
          ...s.messages,
          [conversationId]: (s.messages[conversationId] ?? []).map((m) =>
            m.id === tempId ? { ...m, _status: 'failed' as const } : m,
          ),
        },
      }))
    }
  },

  retryMessage: (conversationId, message) => {
    // Remove the failed optimistic message then re-send its content
    set((s) => ({
      messages: {
        ...s.messages,
        [conversationId]: (s.messages[conversationId] ?? []).filter((m) => m.id !== message.id),
      },
    }))
    void get().sendMessage(conversationId, message.content, message.gig_id ?? undefined)
  },

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
}))
