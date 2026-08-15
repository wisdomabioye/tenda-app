import type { Metadata } from 'next'
import Link from 'next/link'
import { APP_INFO } from '@tenda/shared'
import { AuthPanel } from '@/components/auth/AuthPanel'
import { TermsNotice } from '@/components/auth/TermsNotice'
import { buttonVariants } from '@/components/ui'

export const metadata: Metadata = {
  title: 'Sign in with a wallet',
  robots: { index: false },
}

/**
 * Stage-2 stub (task S2.4): the method chooser stays stable while the real
 * connect flow lands in Stage 3. The link-first rule is decision #3 —
 * server-enforced (an unlinked wallet 404s WALLET_NOT_LINKED), not UI
 * preference — so this page states it honestly instead of a dead button.
 */
export default function WalletSignInStubPage() {
  return (
    <AuthPanel
      title="Wallets sign in, email signs up"
      lede="A wallet can only sign in to an account it is already linked to — it never creates one. That rule is enforced by the server, not this page."
    >
      <ol className="flex list-decimal flex-col gap-2 pl-5 text-sm text-content-secondary">
        <li>Create your account with email — it takes one code.</li>
        <li>
          Link your wallet from Settings (in the {APP_INFO.name} app today; here from Stage&nbsp;3).
        </li>
        <li>From then on, your wallet signs you in on any device.</li>
      </ol>
      <div className="flex flex-col gap-3">
        <Link
          href="/signin/email"
          className={buttonVariants({ variant: 'primary' })}
        >
          Continue with email
        </Link>
        <a
          href={APP_INFO.external.tendaPlayStore}
          className={buttonVariants({ variant: 'outline' })}
        >
          Get the mobile app
        </a>
      </div>
      <TermsNotice verb="connecting" />
    </AuthPanel>
  )
}
