import Link from 'next/link'
import { buttonVariants } from '@/components/ui'

/**
 * Global 404 — also what a hidden (taken-down) gig resolves to for anonymous
 * readers. Next injects <meta name="robots" content="noindex"> on every 404
 * response, which is the second half of the takedown contract.
 */
export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-4 text-center">
      <p className="font-numeric text-sm text-content-tertiary">404</p>
      <h1 className="font-display text-3xl font-bold text-content-primary">
        This page isn&apos;t here
      </h1>
      <p className="max-w-md text-content-secondary">
        The link may be wrong, or the listing may no longer be available.
      </p>
      <Link
        href="/gigs"
        className={`mt-3 ${buttonVariants({ variant: 'primary' })}`}
      >
        Browse gigs
      </Link>
    </div>
  )
}
