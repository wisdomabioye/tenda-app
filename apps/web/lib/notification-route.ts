/**
 * WEB's routing table for a notification's `data` bag. The `screen`
 * VOCABULARY is shared (NOTIFICATION_SCREEN — server push-builders and every
 * client agree on the words); the routing TABLE is deliberately per-client
 * (documented in shared/constants/notifications.ts: the same screen resolves
 * to different destinations per surface).
 *
 * Web's map stays client-specific because its route shapes differ from mobile
 * and admin, while its accepted payload fields come from the server builders.
 */
import { NOTIFICATION_SCREEN } from '@tenda/shared'

export function notificationRoute(data: Record<string, string> | null): string | null {
  if (data === null) return null
  const { screen, escrowId, kind, userId, intentId } = data
  if (screen === NOTIFICATION_SCREEN.escrow && escrowId) {
    return kind === 'exchange' ? `/exchange/${escrowId}` : `/gig/${escrowId}`
  }
  if (screen === NOTIFICATION_SCREEN.dispute && escrowId) return `/dispute/${escrowId}`
  if (screen === NOTIFICATION_SCREEN.chat && userId) return `/chat/${userId}`
  if (screen === NOTIFICATION_SCREEN.fiatIntent && intentId) return `/wallet/intents/${intentId}`
  return null
}
