'use client'

/**
 * The authed workspace chrome — the ANALOGUE of mobile's (tabs)/_layout, not
 * a copy, and deliberately simpler than the design comps (user direction:
 * clean and modern; three-pane list→detail arrives with the surfaces that
 * need it). Top bar: brand, primary nav, theme toggle, sign out.
 */
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import type { ReactNode } from 'react'
import { APP_INFO, displayName } from '@tenda/shared'
import { useAuthStore } from '@/stores/auth.store'
import { ThemeToggle } from './ThemeToggle'

const NAV = [
  { href: '/home', label: 'Home' },
  { href: '/post', label: 'Post a Gig' },
  { href: '/my-gigs', label: 'My Gigs' },
  { href: '/messages', label: 'Messages' },
  { href: '/wallet', label: 'Wallet' },
] as const

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const user = useAuthStore((s) => s.user)
  const logout = useAuthStore((s) => s.logout)

  async function handleLogout() {
    await logout()
    router.replace('/gigs')
  }

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-10 border-b border-border-subtle bg-surface-navbar backdrop-blur">
        <div className="mx-auto flex w-full max-w-5xl items-center gap-5 px-4 py-3">
          <Link href="/home" className="font-display text-xl font-bold tracking-tight text-content-primary">
            {APP_INFO.name}
          </Link>
          <nav className="flex items-center gap-1 overflow-x-auto" aria-label="Primary">
            {NAV.map((item) => {
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
                </Link>
              )
            })}
          </nav>
          <div className="ml-auto flex items-center gap-2">
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
