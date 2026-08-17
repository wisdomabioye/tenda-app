'use client'

/**
 * Wallet sign-in (S3.4). Decision #3 is server-enforced: a wallet only signs
 * in to an account it is already linked to — the verify route answers 404
 * WALLET_NOT_LINKED for an unknown wallet, and that answer is a FIRST-CLASS
 * state here (guidance to email sign-up + try-another-wallet), never a toast.
 * A user decline quietly returns to idle; other failures render the shared
 * connect-error copy.
 */
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  ApiClientError,
  ErrorCode,
  classifyConnectError,
  type ConnectErrorCopy,
} from '@tenda/shared'
import { useAuthStore } from '@/stores/auth.store'
import { reownAdapter } from '@/wallet/adapters/reown'
import { WEB_NO_WALLET_COPY } from '@/wallet/connect-copy'
import { getEnv } from '@/lib/config/env'
import { Button, buttonVariants } from '@/components/ui'
import { AuthPanel } from './AuthPanel'
import { AUTH_COPY } from './copy'
import { TermsNotice } from './TermsNotice'

/** Every wallet state is a step past the chooser, so every one offers the way back. */
const BACK = { href: '/signin', label: AUTH_COPY.wallet.back } as const

type PanelState =
  | { kind: 'idle' }
  | { kind: 'connecting' }
  | { kind: 'not_linked' }
  | { kind: 'error'; copy: ConnectErrorCopy }

function EmailLink({ variant }: { variant: 'primary' | 'outline' }) {
  return (
    <Link href="/signin/email" className={buttonVariants({ variant })}>
      Continue with email
    </Link>
  )
}

export function WalletSignInPanel() {
  const router = useRouter()
  const signInWithWallet = useAuthStore((s) => s.signInWithWallet)
  const [state, setState] = useState<PanelState>({ kind: 'idle' })
  const [available, setAvailable] = useState<boolean | null>(null)

  useEffect(() => {
    void reownAdapter.isAvailable().then(setAvailable)
  }, [])

  async function handleConnect(opts?: { fresh?: boolean }) {
    setState({ kind: 'connecting' })
    try {
      // "Try another wallet": drop the session first so the modal re-opens
      // instead of fast-pathing back to the wallet that just 404'd.
      if (opts?.fresh) await reownAdapter.disconnect().catch(() => {})
      const signedIn = await signInWithWallet(reownAdapter)
      if (!signedIn) {
        setState({ kind: 'idle' }) // declined in the wallet — no error banner
        return
      }
      router.replace(useAuthStore.getState().profileComplete === true ? '/home' : '/onboarding/profile')
    } catch (error) {
      if (error instanceof ApiClientError && error.code === ErrorCode.WALLET_NOT_LINKED) {
        setState({ kind: 'not_linked' })
        return
      }
      setState({
        kind: 'error',
        copy: classifyConnectError(error, {
          devDetail: getEnv() === 'development',
          noWalletCopy: WEB_NO_WALLET_COPY,
        }),
      })
    }
  }

  if (state.kind === 'not_linked') {
    return (
      <AuthPanel
        back={BACK}
        title="This wallet isn’t linked yet"
        lede="A wallet can only sign in to an account it is already linked to — it never creates one. Create your account with email, link this wallet from Settings, and it signs you in from then on."
      >
        <div className="flex flex-col gap-3">
          <EmailLink variant="primary" />
          <Button variant="outline" fullWidth onClick={() => void handleConnect({ fresh: true })}>
            Try another wallet
          </Button>
        </div>
      </AuthPanel>
    )
  }

  if (state.kind === 'error') {
    return (
      <AuthPanel back={BACK} title={state.copy.title} lede={state.copy.description}>
        <div className="flex flex-col gap-3">
          <Button variant="primary" fullWidth onClick={() => void handleConnect()}>
            Try again
          </Button>
          {/* No secondary-URL action here: web's no_wallet override carries no
              link, and every other web-reachable copy is link-free. */}
          <EmailLink variant="outline" />
        </div>
      </AuthPanel>
    )
  }

  const connecting = state.kind === 'connecting'
  return (
    <AuthPanel
      back={BACK}
      title="Sign in with a wallet"
      lede="Connect any Solana or EVM wallet you have linked to your account. New here? Wallets never create accounts — start with email."
    >
      <div className="flex flex-col gap-3">
        {available === false ? (
          <p className="text-sm text-content-secondary">{WEB_NO_WALLET_COPY.description}</p>
        ) : (
          <Button
            variant="primary"
            fullWidth
            disabled={connecting || available === null}
            onClick={() => void handleConnect()}
          >
            {connecting ? 'Waiting for wallet…' : 'Connect wallet'}
          </Button>
        )}
        <EmailLink variant="outline" />
      </div>
      <TermsNotice verb="connecting" />
    </AuthPanel>
  )
}
