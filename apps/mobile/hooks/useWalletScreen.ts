import { useState, useCallback, useMemo } from 'react'
import { useFocusEffect } from 'expo-router'
import { api } from '@/api/client'
import { useAuthStore } from '@/stores/auth.store'
import { useChainRegistryStore } from '@/stores/chain-registry.store'
import { readWalletBalances, sumUsdcRaw, type WalletChainBalance } from '@/wallet/balances'
import { groupByDay } from '@/lib/date'
import { ASSET_META, amountRawToDisplay } from '@tenda/shared'
import type { UserEscrowTransaction } from '@tenda/shared'

// USDC is the gig settlement unit on every chain; lifetime totals are summed in
// USDC base units (all 6dp) so they never mix units. Non-USDC rows (native gas,
// SOL exchange escrows) still show their own amounts in the feed via TxRow.
const isUsdcTx = (tx: UserEscrowTransaction): boolean =>
  (ASSET_META[tx.escrow.asset]?.symbol ?? tx.escrow.asset) === 'USDC'

/**
 * Wallet screen data controller, multichain. Drives off the authoritative
 * linked-wallet list (`wallets[]`) and the chain registry (token addresses),
 * NOT the single Solana session address. Owns: per-(wallet,chain) balances, the
 * summed-USDC headline, the transaction feed, and USDC lifetime earned/spent.
 */
export function useWalletScreen() {
  const user          = useAuthStore((s) => s.user)
  const wallets       = useAuthStore((s) => s.wallets)
  const walletsStatus = useAuthStore((s) => s.walletsStatus)
  const retryWallets  = useAuthStore((s) => s.retryWalletSync)
  const chains        = useChainRegistryStore((s) => s.chains)

  const [balances, setBalances]         = useState<WalletChainBalance[]>([])
  const [transactions, setTransactions] = useState<UserEscrowTransaction[]>([])
  const [isLoading, setIsLoading]       = useState(true)
  const [refreshing, setRefreshing]     = useState(false)

  const hasWallet = wallets.length > 0

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true)
    else setIsLoading(true)
    try {
      // allSettled so one failure (RPC hiccup / tx fetch) can't wedge the screen.
      await Promise.allSettled([
        readWalletBalances(wallets, chains ?? [])
          .then(setBalances)
          .catch(() => setBalances([])),
        user?.id
          ? api.users.transactions({ id: user.id })
              .then((r) => setTransactions(r.data))
              .catch(() => setTransactions([]))
          : Promise.resolve(setTransactions([])),
      ])
    } finally {
      // Always settle loading, no early-return path can strand the skeleton.
      if (isRefresh) setRefreshing(false)
      else setIsLoading(false)
    }
  }, [user?.id, wallets, chains])

  useFocusEffect(
    useCallback(() => {
      void load()
    }, [load]),
  )

  const handleRefresh = useCallback(() => load(true), [load])

  // Headline: USDC summed across every wallet×chain (one unit, exact base-units).
  const totalUsdcRaw = sumUsdcRaw(balances)
  const usdcAssetId = balances.find((b) => b.usdc)?.usdc?.assetId ?? 'USDC_SOL'
  const totalUsdc = amountRawToDisplay(totalUsdcRaw, usdcAssetId)

  const earnedUsdc = transactions.reduce((sum, tx) => {
    if (!isUsdcTx(tx) || tx.escrow.counterparty_id !== user?.id) return sum
    if (tx.type !== 'approve' && tx.type !== 'claim_stalled' && tx.type !== 'resolve') return sum
    // Settlement rows record the chain-attested NET credit (the contract
    // events emit the payout after the platform fee; resolve rows carry the
    // counterparty's share). Rows with no attested amount are skipped —
    // never estimated from the gross principal.
    if (tx.amount_raw === null) return sum
    return sum + amountRawToDisplay(tx.amount_raw, tx.escrow.asset)
  }, 0)

  const spentUsdc = transactions.reduce((sum, tx) => {
    if (!isUsdcTx(tx) || tx.escrow.creator_id !== user?.id || tx.type !== 'create') return sum
    return sum + amountRawToDisplay(tx.amount_raw ?? tx.escrow.amount_raw, tx.escrow.asset)
  }, 0)

  const feed = useMemo(
    () => groupByDay(transactions, (tx) => tx.created_at, (tx) => tx.id, 'tx'),
    [transactions],
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
    isLoading,
    refreshing,
    handleRefresh,
  }
}
