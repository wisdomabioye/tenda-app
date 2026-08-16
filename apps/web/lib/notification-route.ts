/**
 * WEB's routing table for a notification's `data` bag. The `screen`
 * VOCABULARY is shared (NOTIFICATION_SCREEN — server push-builders and every
 * client agree on the words); the routing TABLE is deliberately per-client
 * (documented in shared/constants/notifications.ts: the same screen resolves
 * to different destinations per surface).
 *
 * Web's map, honest about what exists: escrow(gig) → /gig, chat → /chat.
 * Exchange detail (S6.4) and the dispute thread (S6.1) have no web route
 * yet, so those notices are non-navigable rather than dead links — the row
 * still marks read. Flip them here when the surfaces land.
 */
import { NOTIFICATION_SCREEN } from '@tenda/shared'

export function notificationRoute(data: Record<string, string> | null): string | null {
  if (data === null) return null
  const { screen, escrowId, kind, userId } = data
  if (screen === NOTIFICATION_SCREEN.escrow && escrowId) {
    return kind === 'exchange' ? null : `/gig/${escrowId}`
  }
  if (screen === NOTIFICATION_SCREEN.chat && userId) return `/chat/${userId}`
  // NOTIFICATION_SCREEN.dispute → S6.1; NOTIFICATION_SCREEN.fiatIntent → S6.4.
  return null
}
