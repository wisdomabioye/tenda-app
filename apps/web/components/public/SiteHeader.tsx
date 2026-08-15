import Link from 'next/link'
import { APP_INFO } from '@tenda/shared'
import { HeaderSessionAction } from './HeaderSessionAction'

/**
 * Tier-1 public chrome. Deliberately minimal (user direction 2026-08-15):
 * marketing lives on apps/tendahq — this header only orients and offers the
 * way in. No app chrome, no empty rails. Brand strings come from the shared
 * APP_INFO, never inline.
 */
export function SiteHeader() {
  return (
    <header className="sticky top-0 z-10 border-b border-border-subtle bg-surface-navbar backdrop-blur">
      <div className="mx-auto flex w-full max-w-5xl items-center justify-between px-4 py-3">
        <Link
          href="/gigs"
          className="font-display text-xl font-bold tracking-tight text-content-primary"
        >
          {APP_INFO.name}
        </Link>
        <nav className="flex items-center gap-5">
          <Link
            href="/gigs"
            className="text-sm font-semibold text-content-secondary hover:text-content-primary"
          >
            Gigs
          </Link>
          <HeaderSessionAction />
        </nav>
      </div>
    </header>
  )
}
