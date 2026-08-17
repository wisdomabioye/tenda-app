import Link from 'next/link'
import { BrandMark } from './BrandMark'
import { HeaderSessionAction } from './HeaderSessionAction'

/**
 * Tier-1 public chrome (comp lines 371-388): wordmark, section nav, theme
 * toggle, way in.
 *
 * `apps/tendahq` remains the marketing surface — this header only orients and
 * offers the way in. The comp also links "Foundations"; that page does not
 * exist yet, and a nav pointing at a 404 is worse than a nav that waits.
 */
const NAV = [
  { href: '/gigs', label: 'Browse gigs' },
  { href: '/support', label: 'Support' },
] as const

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-30 border-b border-border-subtle bg-surface-navbar backdrop-blur-[14px]">
      <div className="mx-auto flex w-full max-w-content items-center gap-6 px-6 py-3.5 sm:gap-8">
        <BrandMark />
        <nav className="flex flex-1 items-center gap-1">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-sm px-3 py-2 text-sm font-semibold text-content-secondary hover:bg-surface-inset hover:text-content-primary"
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <HeaderSessionAction />
      </div>
    </header>
  )
}
