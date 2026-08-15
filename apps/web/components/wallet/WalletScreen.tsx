'use client'

/**
 * /wallet — the dumb switch over `section` (shared resolveWalletSection): a
 * load FAILURE is never rendered as "no wallet linked", and an unusable
 * chain registry is never rendered as a real `0.00` (mobile's two wallet-
 * screen bugs, pinned by the shared resolver's tests).
 */
import Link from 'next/link'
import { useWalletScreen } from '@/hooks/useWalletScreen'
import { WalletHeroCard } from './WalletHeroCard'
import { WalletBalanceRows } from './WalletBalanceRows'
import { TxFeed } from './TxFeed'
import { Button, buttonVariants } from '@/components/ui'

function Retryable({ message, actionLabel, onRetry }: { message: string; actionLabel: string; onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-card border border-border-subtle bg-surface-card px-6 py-8 text-center">
      <p className="text-sm text-content-secondary">{message}</p>
      <Button variant="outline" size="md" onClick={onRetry}>
        {actionLabel}
      </Button>
    </div>
  )
}

export function WalletScreen() {
  const screen = useWalletScreen()

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
      <header className="flex items-center justify-between">
        <h1 className="font-display text-3xl font-bold text-content-primary">Wallet</h1>
        <Button variant="ghost" size="md" disabled={screen.refreshing} onClick={() => void screen.handleRefresh()}>
          {screen.refreshing ? 'Refreshing…' : 'Refresh'}
        </Button>
      </header>

      {screen.section === 'no-wallet' && (
        <div className="flex flex-col items-center gap-3 rounded-card border border-border-subtle bg-surface-card px-6 py-8 text-center">
          <p className="text-sm text-content-secondary">
            No wallet linked yet. Link one to see balances and receive payments.
          </p>
          <Link href="/settings/linked-wallets" className={buttonVariants({ variant: 'primary', size: 'md' })}>
            Link a wallet
          </Link>
        </div>
      )}
      {screen.section === 'wallets-error' && (
        <Retryable
          message="Could not load your linked wallets."
          actionLabel="Retry"
          onRetry={() => void screen.retryWallets()}
        />
      )}
      {screen.section === 'balances-unavailable' && (
        <Retryable
          message="Balances are unavailable right now — the chain registry could not be loaded."
          actionLabel="Retry"
          onRetry={() => void screen.retryChains()}
        />
      )}
      {(screen.section === 'ready' || screen.section === 'loading') && (
        <>
          <WalletHeroCard
            totalUsdc={screen.totalUsdc}
            earnedUsdc={screen.earnedUsdc}
            spentUsdc={screen.spentUsdc}
            isLoading={screen.section === 'loading' || screen.isLoading}
          />
          {screen.section === 'ready' && <WalletBalanceRows balances={screen.balances} />}
        </>
      )}

      {screen.user !== null && (
        <TxFeed
          feed={screen.feed}
          userId={screen.user.id}
          isLoading={screen.isLoadingTransactions}
          hasMore={screen.hasMoreTransactions}
          isLoadingMore={screen.isLoadingMoreTransactions}
          onLoadMore={() => void screen.loadMoreTransactions()}
        />
      )}
    </div>
  )
}
