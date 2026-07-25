import { useState, useCallback, useMemo, useRef } from 'react'
import { useFocusEffect } from 'expo-router'
import { api } from '@/api/client'
import { useAuthStore } from '@/stores/auth.store'
import { useChainRegistryStore } from '@/stores/chain-registry.store'
import { readWalletBalances, sumUsdcRaw, type WalletChainBalance } from '@/wallet/balances'
import { groupByDay } from '@/lib/date'
import { usePaginatedList } from '@/hooks/usePaginatedList'
import { amountRawToDisplay } from '@tenda/shared'
import type {
  UserEscrowTransaction,
  UserTransactionsQuery,
  UserTransactionsSummary,
} from '@tenda/shared'

const EMPTY_SUMMARY: UserTransactionsSummary = {
  earned_raw: '0',
  spent_raw: '0',
  asset: 'USDC_SOL',
}

const txKey = (tx: UserEscrowTransaction) => tx.id

/**
 * Wallet screen data controller, multichain. Drives off the authoritative
 * linked-wallet list (`wallets[]`) and the chain registry (token addresses),
 * NOT the single Solana session address. Owns: per-(wallet,chain) balances,
 * the summed-USDC headline, the paginated transaction feed, and the USDC
 * lifetime earned/spent totals.
 *
 * Lifetime totals come from `/transactions/summary`, a SQL aggregate over
 * EVERY row — they are NOT reduced from the feed (open_issues MB1). Reducing
 * a page was already understated, and now that the feed pages it would have
 * climbed as the user scrolled, which is worse than being merely wrong.
 */
export function useWalletScreen() {
  const user          = useAuthStore((s) => s.user)
  const wallets       = useAuthStore((s) => s.wallets)
  const walletsStatus = useAuthStore((s) => s.walletsStatus)
  const retryWallets  = useAuthStore((s) => s.retryWalletSync)
  const chains        = useChainRegistryStore((s) => s.chains)

  const [balances, setBalances]   = useState<WalletChainBalance[]>([])
  const [summary, setSummary]     = useState<UserTransactionsSummary>(EMPTY_SUMMARY)
  const [isLoading, setIsLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const userId = user?.id ?? null
  const hasWallet = wallets.length > 0

  // The feed itself: paginated, and the ONLY consumer of transaction rows now
  // that the totals are server-computed.
  const transactions = usePaginatedList<UserEscrowTransaction, UserTransactionsQuery>({
    fetchPage: (params) => api.users.transactions({ id: userId ?? '' }, params),
    query: {},
    keyOf: txKey,
    enabled: userId !== null,
  })

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true)
    else setIsLoading(true)
    try {
      // allSettled so one failure (an RPC hiccup, a summary blip) can't wedge
      // the screen or hide the other half of it.
      await Promise.allSettled([
        readWalletBalances(wallets, chains ?? [])
          .then(setBalances)
          .catch(() => setBalances([])),
        userId === null
          ? Promise.resolve(setSummary(EMPTY_SUMMARY))
          : api.users
              .transactionsSummary({ id: userId })
              .then(setSummary)
              // Keep the last good totals rather than flashing zeroes, which
              // would read as "you have earned nothing".
              .catch(() => {}),
      ])
    } finally {
      // Always settle loading, no early-return path can strand the skeleton.
      if (isRefresh) setRefreshing(false)
      else setIsLoading(false)
    }
  }, [userId, wallets, chains])

  // Mirrored into a ref so the focus callback's identity does NOT change when
  // the feed settles — that would re-fire the whole focus effect and turn the
  // first load into two.
  const feedFetchedRef = useRef(false)
  feedFetchedRef.current = transactions.hasFetched

  useFocusEffect(
    useCallback(() => {
      void load()
      // The controller's own query effect owns page 0 (mount, and the gate
      // opening once the user id is known); every LATER focus has to re-read
      // it explicitly. Wallet is a tab, so it stays mounted — without this,
      // coming back after approving an escrow shows freshly-refetched lifetime
      // totals next to a transaction list that never learned about the row.
      // `reload` (not `refresh`) is the preserve-loaded-pages variant, so a
      // user who scrolled doesn't get yanked back to page 0.
      if (feedFetchedRef.current) void transactions.reload()
      // `transactions.reload` is stable (see usePaginatedList), and the flag is
      // read through a ref, so neither belongs in the dep list.
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [load]),
  )

  const handleRefresh = useCallback(async () => {
    // Awaited together so a caller can't observe "refreshed" while half of it
    // is still in flight. The spinner itself is driven by the UNION of the two
    // refreshing flags (see the returned `refreshing`) — RefreshControl is a
    // controlled prop, so awaiting here alone would not keep it spinning.
    await Promise.all([transactions.refresh(), load(true)])
    // `transactions.refresh` is stable (see usePaginatedList).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [load])

  // Headline: USDC summed across every wallet×chain (one unit, exact base-units).
  const totalUsdcRaw = sumUsdcRaw(balances)
  const usdcAssetId = balances.find((b) => b.usdc)?.usdc?.assetId ?? 'USDC_SOL'
  const totalUsdc = amountRawToDisplay(totalUsdcRaw, usdcAssetId)

  const earnedUsdc = amountRawToDisplay(summary.earned_raw, summary.asset)
  const spentUsdc = amountRawToDisplay(summary.spent_raw, summary.asset)

  const feed = useMemo(
    () => groupByDay(transactions.items, (tx) => tx.created_at, (tx) => tx.id, 'tx'),
    [transactions.items],
  )

  return {
    user,
    hasWallet,
    // Lifecycle of the linked-wallet load, so the screen distinguishes "still
    // loading" and "load failed" from "genuinely no wallet" (was: any of these
    // fell through to the empty state).
    walletsStatus,
    retryWallets,
    balances,
    totalUsdc,
    earnedUsdc,
    spentUsdc,
    feed,
    /** Paging controls for the transaction feed (the screen renders `feed`). */
    loadMoreTransactions: transactions.loadMore,
    isLoadingMoreTransactions: transactions.isLoadingMore,
    isLoading,
    /**
     * The FEED's own first-page state, kept separate from `isLoading` (which
     * covers balances + totals). The screen needs both: `isLoading` drives the
     * hero skeleton, this one gates the "No transactions yet" empty state.
     * Conflating them would either spin the hero while only the feed loads, or
     * — the bug this fixes — declare the list empty as soon as the cheaper
     * summary request settled, flashing "No transactions yet" over a feed that
     * was still in flight. It reads false when the list is gated off (no user),
     * so a screen that will never fetch still reaches its empty state.
     */
    isLoadingTransactions: transactions.isLoading,
    // Union of both halves: pull-to-refresh must keep spinning until the feed
    // has landed too, not just the balances and totals.
    refreshing: refreshing || transactions.isRefreshing,
    handleRefresh,
  }
}
