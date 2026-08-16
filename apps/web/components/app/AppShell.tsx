'use client'

/**
 * The authed workspace chrome — the ANALOGUE of mobile's (tabs)/_layout, not
 * a copy, and deliberately simpler than the design comps (user direction:
 * clean and modern; three-pane list→detail arrives with the surfaces that
 * need it). Top bar: brand, primary nav, theme toggle, sign out.
 */
import Link from 'next/link'
import { Bell as BellIcon } from 'lucide-react'
import { usePathname, useRouter } from 'next/navigation'
import type { ReactNode } from 'react'
import { APP_INFO, displayName } from '@tenda/shared'
import { useAuthStore } from '@/stores/auth.store'
import { useChatStore } from '@/stores/chat.store'
import { useNotificationsStore } from '@/stores/notifications.store'
import { useRealtimeConnection } from '@/hooks/connectivity/useRealtimeConnection'
import { useInboxRealtime } from '@/hooks/chat/useInboxRealtime'
import { useNotificationsRealtime } from '@/hooks/notifications/useNotificationsRealtime'
import { ThemeToggle } from './ThemeToggle'

const NAV = [
  { href: '/home', label: 'Home' },
  { href: '/post', label: 'Post a Gig' },
  { href: '/my-gigs', label: 'My Gigs' },
  { href: '/messages', label: 'Messages' },
  { href: '/wallet', label: 'Wallet' },
] as const

/** Shown only once the CO4 advanced-mode toggle unlocks the P2P surface. */
const EXCHANGE_NAV = { href: '/exchange', label: 'Trade' } as const

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const user = useAuthStore((s) => s.user)
  const logout = useAuthStore((s) => s.logout)
  // Socket lifecycle rides the authed shell: mobile mounts this in the root
  // _layout, but web's root layout also serves the anonymous public pages.
  useRealtimeConnection()
  // Inbox mirror + bell badge (mobile mounts both in (tabs)/_layout).
  useInboxRealtime()
  useNotificationsRealtime()
  const unread = useChatStore((s) => s.unread)
  const notificationUnread = useNotificationsStore((s) => s.unread)
  const navItems = user?.advanced_mode_enabled ? [...NAV, EXCHANGE_NAV] : [...NAV]

  async function handleLogout() {
    await logout()
    router.replace('/gigs')
  }

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-10 border-b border-border-subtle bg-surface-navbar backdrop-blur">
        {/* h-14 is PINNED: ChatThread's viewport lock subtracts exactly
            56px + the 1px border — a padding-derived height would silently
            break that arithmetic. */}
        <div className="mx-auto flex h-14 w-full max-w-5xl items-center gap-5 px-4">
          <Link href="/home" className="font-display text-xl font-bold tracking-tight text-content-primary">
            {APP_INFO.name}
          </Link>
          <nav className="flex items-center gap-1 overflow-x-auto" aria-label="Primary">
            {navItems.map((item) => {
              const active = pathname.startsWith(item.href)
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? 'page' : undefined}
                  className={
                    active
                      ? 'rounded-control bg-brand-primary-surface px-3 py-2 text-sm font-semibold text-brand-primary'
                      : 'rounded-control px-3 py-2 text-sm font-semibold text-content-secondary hover:bg-surface-inset hover:text-content-primary'
                  }
                >
                  {item.label}
                  {item.href === '/messages' && unread > 0 && (
                    <span
                      aria-label={`${unread} unread messages`}
                      className="ml-1.5 inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-brand-solid px-1 font-numeric text-[10.5px] font-bold text-brand-on-primary"
                    >
                      {unread > 9 ? '9+' : unread}
                    </span>
                  )}
                </Link>
              )
            })}
          </nav>
          <div className="ml-auto flex items-center gap-2">
            <Link
              href="/notifications"
              aria-label={
                notificationUnread > 0
                  ? `Notifications, ${notificationUnread} unread`
                  : 'Notifications'
              }
              className="relative flex h-9 w-9 items-center justify-center rounded-control text-content-secondary hover:bg-surface-inset hover:text-content-primary"
            >
              <BellIcon size={18} />
              {notificationUnread > 0 && (
                <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-brand-solid px-0.5 font-numeric text-[10px] font-bold text-brand-on-primary">
                  {notificationUnread > 9 ? '9+' : notificationUnread}
                </span>
              )}
            </Link>
            <ThemeToggle />
            <Link
              href="/profile"
              className="max-w-32 truncate rounded-control px-3 py-2 text-sm font-semibold text-content-secondary hover:bg-surface-inset hover:text-content-primary"
            >
              {user !== null ? displayName(user.first_name, user.last_name, user.id) : 'Profile'}
            </Link>
            <button
              type="button"
              onClick={() => void handleLogout()}
              className="rounded-control px-3 py-2 text-sm font-semibold text-content-tertiary hover:bg-surface-inset hover:text-content-primary"
            >
              Sign out
            </button>
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-5">{children}</main>
    </div>
  )
}
