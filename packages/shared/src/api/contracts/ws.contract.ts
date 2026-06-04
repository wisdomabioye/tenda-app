/**
 * WebSocket wire contract — `/v1/ws` (stage-2-listeners.md).
 *
 * Handshake: the client sends the JWT via subprotocol
 * `['tenda.v1.auth', <JWT>]`; servers behind proxies that strip
 * subprotocols accept a `{ auth: <JWT> }` first frame within 5s instead.
 *
 * Client → server frames: `{ sub: '<channel>' }` / `{ unsub: '<channel>' }`.
 * Server → client frames always carry `channel` plus a `type` discriminant.
 */

import type { Message } from '../../types/chat'

export const WS_PATH = '/v1/ws'
export const WS_AUTH_SUBPROTOCOL = 'tenda.v1.auth'

export type WsChannelKind = 'escrow' | 'chat' | 'user'

export function wsChannelName(kind: WsChannelKind, id: string): string {
  return `${kind}:${id}`
}

/** New chat message — broadcast on `chat:<conversation_id>`. */
export interface ChatMessageFrame {
  channel: string
  type: 'message'
  message: Message
}

/**
 * Escrow state change — broadcast on `escrow:<escrow_id>` after the
 * verify-tx pipeline applies an event. `event` is the wire event name
 * (e.g. 'approved', 'accepted'); `tx_ref` is the on-chain signature/hash
 * the client correlates against its pending transaction.
 */
export interface EscrowEventFrame {
  channel: string
  type: 'escrow_event'
  escrow_id: string
  event: string
  tx_ref: string
}

export type WsServerFrame = ChatMessageFrame | EscrowEventFrame
