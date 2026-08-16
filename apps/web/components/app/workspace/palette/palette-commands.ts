/**
 * What the command palette can jump to.
 *
 * Surfaces come from the rail config, so the palette and the rail can never
 * disagree about where you can go — including the advanced-mode gate. Richer
 * sources (escrows, conversations) plug in as extra command arrays when those
 * surfaces land; the palette itself never learns about them.
 */
import type { LucideIcon } from 'lucide-react'
import { Plus, Settings, User } from 'lucide-react'
import {
  RAIL_ACTION,
  RAIL_PROFILE,
  RAIL_SETTINGS,
  visibleRailItems,
} from '@/components/app/workspace/rail'

export interface PaletteCommand {
  /** Stable identity — also the React key and the aria-activedescendant id. */
  id: string
  label: string
  /** Trailing monospace tag: 'go' for a surface, a status, 'thread'… */
  hint: string
  href: string
  icon: LucideIcon
}

/** The comps cap the list at 8 so it never becomes a scroll-hunt. */
export const PALETTE_RESULT_LIMIT = 8

export const PALETTE_EMPTY_COPY = 'Nothing matches. Try a gig title, a city or a person.'
export const PALETTE_PLACEHOLDER = 'Jump to a surface, gig or person'

const GO = 'go'

/** Every destination the rail offers this user, plus its foot actions. */
export function surfaceCommands(advancedModeEnabled: boolean): PaletteCommand[] {
  return [
    ...visibleRailItems(advancedModeEnabled).map((item) => ({
      id: `surface:${item.href}`,
      label: item.label,
      hint: GO,
      href: item.href,
      icon: item.icon,
    })),
    { id: 'action:post', label: RAIL_ACTION.label, hint: GO, href: RAIL_ACTION.href, icon: Plus },
    {
      id: 'action:settings',
      label: RAIL_SETTINGS.label,
      hint: GO,
      href: RAIL_SETTINGS.href,
      icon: Settings,
    },
    {
      id: 'action:profile',
      label: RAIL_PROFILE.label,
      hint: GO,
      href: RAIL_PROFILE.href,
      icon: User,
    },
  ]
}

/**
 * Case-insensitive substring match on the label, capped.
 *
 * An empty query lists everything (capped) rather than nothing — opening the
 * palette should show where you can go, not an empty box.
 */
export function filterCommands(
  commands: readonly PaletteCommand[],
  query: string,
  limit: number = PALETTE_RESULT_LIMIT,
): PaletteCommand[] {
  // No empty-query special case is needed: every string contains '', so an
  // empty needle already matches everything.
  const needle = query.trim().toLowerCase()
  return commands.filter((command) => command.label.toLowerCase().includes(needle)).slice(0, limit)
}
