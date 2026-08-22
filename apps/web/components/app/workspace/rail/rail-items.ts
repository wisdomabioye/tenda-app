/**
 * Rail navigation config — data, not JSX, so the item set is testable without
 * rendering and a new destination is one entry rather than a new branch.
 *
 * Deliberately store-free: an item declares WHICH counter it shows via
 * `badge`, and Rail resolves the number. That keeps this module pure and
 * stops the config from reaching into state it has no business knowing about.
 */
import {
  ArrowLeftRight,
  Bell,
  Home,
  ListChecks,
  MessageSquare,
  Wallet,
  type LucideIcon,
} from 'lucide-react'

/** Which live counter an item surfaces. */
export type RailBadgeSource = 'messages' | 'notifications'

export interface RailItem {
  href: string
  /** Accessible name — the rail is icon-only, so this is the ONLY label. */
  label: string
  icon: LucideIcon
  badge?: RailBadgeSource
  /** Shown only once the CO4 advanced-mode toggle unlocks the P2P surface. */
  requiresAdvancedMode?: boolean
}

/**
 * Every destination the previous top-nav shell could reach is present:
 * Home, My Gigs, Messages, Wallet and the gated Trade item carry over from
 * its NAV/EXCHANGE_NAV, the bell becomes the Notifications item, and Post
 * becomes the rail's primary action (see RAIL_ACTION).
 */
export const RAIL_ITEMS: readonly RailItem[] = [
  { href: '/home', label: 'Home', icon: Home },
  { href: '/my-gigs', label: 'My Gigs', icon: ListChecks },
  { href: '/messages', label: 'Messages', icon: MessageSquare, badge: 'messages' },
  { href: '/notifications', label: 'Notifications', icon: Bell, badge: 'notifications' },
  { href: '/wallet', label: 'Wallet', icon: Wallet },
  { href: '/exchange', label: 'Trade', icon: ArrowLeftRight, requiresAdvancedMode: true },
]

/** The rail's primary action, pinned below the scrollable item list. */
export const RAIL_ACTION = { href: '/create', label: 'Create' } as const

export const RAIL_SETTINGS = { href: '/settings', label: 'Settings' } as const
export const RAIL_PROFILE = { href: '/profile', label: 'Your profile' } as const

/**
 * Segment-aware active test. A plain `startsWith` would light up My Gigs on
 * a hypothetical `/my-gigs-archive`, and Wallet on `/walletsomething` — the
 * href must match the whole path or a whole leading segment of it.
 */
export function isRailItemActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`)
}

/** The items this user can actually see. */
export function visibleRailItems(advancedModeEnabled: boolean): readonly RailItem[] {
  return RAIL_ITEMS.filter((item) => item.requiresAdvancedMode !== true || advancedModeEnabled)
}
