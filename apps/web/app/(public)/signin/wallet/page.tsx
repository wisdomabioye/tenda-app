import type { Metadata } from 'next'
import { WalletSignInPanel } from '@/components/auth/WalletSignInPanel'

export const metadata: Metadata = {
  title: 'Sign in with a wallet',
  robots: { index: false },
}

/**
 * Server shell only — the connect flow is fully client-side (the JWT and the
 * wallet session both live in the browser; see apps/web/CLAUDE.md). Wallet
 * libraries stay OUT of this page's bundle until the panel actually connects
 * (lazy runtime boundary, wallet/runtime.ts).
 */
export default function WalletSignInPage() {
  return <WalletSignInPanel />
}
