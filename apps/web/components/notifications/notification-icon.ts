/**
 * Icon for a notification row, derived from its `data.screen`/`kind` —
 * web twin of the icon half of mobile's lib/notificationRoute (the ROUTE
 * half is lib/notification-route.ts; icons are client-specific because the
 * lucide packages differ per platform).
 */
import { Bell, Handshake, ArrowLeftRight, Scale } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { NOTIFICATION_SCREEN } from '@tenda/shared'

export function notificationIcon(data: Record<string, string> | null): LucideIcon {
  if (data === null) return Bell
  if (data.screen === NOTIFICATION_SCREEN.dispute) return Scale
  if (data.screen === NOTIFICATION_SCREEN.escrow) {
    return data.kind === 'exchange' ? ArrowLeftRight : Handshake
  }
  return Bell
}
