/**
 * Realtime store — web port of apps/mobile/stores/realtime.store.ts,
 * bridging the singleton WS client into Zustand + the feature stores.
 *
 * `connected` mirrors the ws client's state into React. Today nothing
 * consumes it yet: it becomes the polling hooks' suppression signal when
 * chat polling lands (S5.2 — poll only while the socket is down) and the
 * reconnect-reconciliation trigger for escrow-live (S5.4). The escrow-sync
 * RPC/projection polls deliberately do NOT consult it, exactly like
 * mobile's: a confirmation wait must converge even if frames never come.
 *
 * S5.1 slice: mobile's subscribeChatChannel / subscribeUserChannel land
 * with the chat and notifications stores they fan into (S5.2 / S5.3) —
 * porting them now would mean stub stores or dead parameters.
 */

import { create } from 'zustand'
import {
  wsChannelName,
  type EscrowEventFrame,
  GIG_FEED_CHANNEL,
  type GigFeedServerFrame,
} from '@tenda/shared'
import { ws, type WsFrame } from '@/lib/ws'

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

export function isEscrowEventFrame(f: WsFrame): f is EscrowEventFrame & WsFrame {
  return (
    f.type === 'escrow_event' &&
    typeof f.escrow_id === 'string' &&
    typeof f.event === 'string' &&
    typeof f.tx_ref === 'string'
  )
}

// ---------- channel subscriptions --------------------------------------------

/** Escrow lifecycle events (verify-tx republish → WS, wired in #33). */
export function subscribeEscrowChannel(
  escrowId: string,
  onEvent: (frame: EscrowEventFrame) => void,
): () => void {
  return ws.subscribe(wsChannelName('escrow', escrowId), (frame) => {
    if (isEscrowEventFrame(frame)) onEvent(frame)
  })
}

export function subscribeGigFeedChannel(
  onEvent: (frame: GigFeedServerFrame) => void,
): () => void {
  return ws.subscribe(GIG_FEED_CHANNEL, (frame) => {
    if (frame.type === 'gig_available' || frame.type === 'gig_unavailable') onEvent(frame)
  })
}
