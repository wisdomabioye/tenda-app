import type { Metadata } from 'next'
import Link from 'next/link'
import { Mail, Wallet } from 'lucide-react'
import { AuthPanel } from '@/components/auth/AuthPanel'
import { TermsNotice } from '@/components/auth/TermsNotice'
import { buttonVariants } from '@/components/ui'

export const metadata: Metadata = {
  title: 'Sign in',
  robots: { index: false },
}

/**
 * Method chooser — the web analogue of mobile's get-started. Email creates
 * accounts; wallet only signs in (decision #3, server-enforced), so the
 * wallet entry is visible from day one but explains link-first until
 * Stage 3 wires the real connect flow. Phone/Google are provisioned
 * server-side and deliberately deferred (stage-2 doc).
 */
export default function SignInPage() {
  return (
    <AuthPanel title="Get started" lede="Sign in or create an account — no password, ever.">
      <div className="flex flex-col gap-3">
        <Link
          href="/signin/email"
          className={buttonVariants({ variant: 'primary' })}
        >
          <Mail size={16} aria-hidden />
          Continue with email
        </Link>
        <Link
          href="/signin/wallet"
          className={buttonVariants({ variant: 'outline' })}
        >
          <Wallet size={16} aria-hidden />
          Sign in with a wallet
        </Link>
      </div>
      <TermsNotice verb="continuing" />
    </AuthPanel>
  )
}
