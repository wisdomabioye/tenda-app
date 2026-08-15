import type { Metadata } from 'next'
import Link from 'next/link'
import { APP_INFO } from '@tenda/shared'

export const metadata: Metadata = {
  title: 'Sign in',
  robots: { index: false },
}

/**
 * Stage-2 builds the real method chooser here (email OTP first, wallet after
 * linking — decision #3). Until then this placeholder keeps header/detail CTAs
 * honest instead of dead.
 */
export default function SignInPlaceholderPage() {
  return (
    <section className="mx-auto flex max-w-md flex-col items-center gap-4 py-16 text-center">
      <h1 className="font-display text-3xl font-bold text-content-primary">
        Sign in is coming to web
      </h1>
      <p className="text-content-secondary">
        Accounts, posting, and applying arrive here shortly. Until then, everything works in the{' '}
        {APP_INFO.name} mobile app — browsing stays open right here.
      </p>
      <div className="flex flex-wrap items-center justify-center gap-3">
        <a
          href={APP_INFO.external.tendaPlayStore}
          className="rounded-control bg-brand-solid px-6 py-3 font-semibold text-brand-on-primary hover:bg-brand-primary-pressed"
        >
          Get the app
        </a>
        <Link
          href="/gigs"
          className="rounded-control border border-border-default px-6 py-3 font-semibold text-content-secondary hover:border-border-strong hover:text-content-primary"
        >
          Browse gigs
        </Link>
      </div>
    </section>
  )
}
