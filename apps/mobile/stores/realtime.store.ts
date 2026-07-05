/**
 * Realtime store (stage-2-listeners.md § Mobile), bridges the singleton
 * WS client into Zustand + the feature stores.
 *
 * `connected` is the polling hooks' suppression signal: while true, chat
 * polling parks on a slow heartbeat and TransactionMonitor stretches its
 * RPC poll; on disconnect both resume their fast cadence automatically.
 */

import { create } from 'zustand'
import { wsChannelName, type Message, type ChatMessageFrame, type EscrowEventFrame } from '@tenda/shared'
import { ws, type WsFrame } from '@/lib/ws'
import { useChatStore } from '@/stores/chat.store'

interface RealtimeState {
  connected: boolean
}

export const useRealtimeStore = create<RealtimeState>(() => ({
  connected: false,
}))

ws.onConnectionChange((connected) => {
  useRealtimeStore.setState({ connected })
})

// ---------- frame guards -----------------------------------------------------

function isMessage(v: unknown): v is Message {
  return (
    typeof v === 'object' && v !== null &&
    'id' in v && typeof v.id === 'string' &&
    'conversation_id' in v && typeof v.conversation_id === 'string' &&
    'sender_id' in v && typeof v.sender_id === 'string' &&
    'content' in v && typeof v.content === 'string'
  )
}

function isChatMessageFrame(f: WsFrame): f is ChatMessageFrame & WsFrame {
  return f.type === 'message' && isMessage(f.message)
}

export function isEscrowEventFrame(f: WsFrame): f is EscrowEventFrame & WsFrame {
  return (
    f.type === 'escrow_event' &&
    typeof f.escrow_id === 'string' &&
    typeof f.event === 'string' &&
    typeof f.tx_ref === 'string'
  )
}

// ---------- channel subscriptions ----------------------------------------------

/**
 * Live messages for an open chat screen. Frames echo back to the sender
 * too, receiveMessage dedupes by id against the optimistic copy.
 */
export function subscribeChatChannel(
  conversationId: string,
  onMessage?: (message: Message) => void,
): () => void {
  return ws.subscribe(wsChannelName('chat', conversationId), (frame) => {
    if (!isChatMessageFrame(frame)) return
    useChatStore.getState().receiveMessage(conversationId, frame.message)
    onMessage?.(frame.message)
  })
}

/**
 * Inbox-level updates, the server mirrors each chat message onto the
 * recipient's `user:<id>` channel so the conversations list / unread badge
 * stays current without polling.
 */
export function subscribeUserChannel(userId: string): () => void {
  return ws.subscribe(wsChannelName('user', userId), (frame) => {
    if (!isChatMessageFrame(frame)) return
    useChatStore.getState().fetchConversations().catch(() => {
      // Network hiccup, the next frame or the fallback poll catches up.
    })
  })
}

/** Escrow lifecycle events (verify-tx republish → WS, wired in #33). */
export function subscribeEscrowChannel(
  escrowId: string,
  onEvent: (frame: EscrowEventFrame) => void,
): () => void {
  return ws.subscribe(wsChannelName('escrow', escrowId), (frame) => {
    if (isEscrowEventFrame(frame)) onEvent(frame)
  })
}
