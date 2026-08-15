import Link from 'next/link'
import { APP_INFO } from '@tenda/shared'

/** Brand strings and outbound links come from the shared APP_INFO, never inline. */
export function SiteFooter() {
  return (
    <footer className="mt-auto border-t border-border-subtle">
      <div className="mx-auto flex w-full max-w-5xl flex-wrap items-center justify-between gap-4 px-4 py-6 text-sm text-content-tertiary">
        <p>
          <span className="font-display font-bold text-content-secondary">{APP_INFO.name}</span> —{' '}
          {APP_INFO.tagline}
        </p>
        <nav className="flex gap-5">
          <Link href="/gigs" className="hover:text-content-primary">
            Browse gigs
          </Link>
          <a href={APP_INFO.external.website} className="hover:text-content-primary">
            About
          </a>
          <a href={APP_INFO.legal.terms} className="hover:text-content-primary">
            Terms
          </a>
          <a href={APP_INFO.legal.privacy} className="hover:text-content-primary">
            Privacy
          </a>
        </nav>
      </div>
    </footer>
  )
}
