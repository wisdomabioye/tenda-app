import { useState, useCallback, useMemo } from 'react'
import { useFocusEffect } from 'expo-router'
import { PublicKey } from '@solana/web3.js'
import { api } from '@/api/client'
import { getBalance } from '@/wallet'
import { useAuthStore } from '@/stores/auth.store'
import { useExchangeRateStore, useSettingsStore } from '@/stores'
import { groupByDay } from '@/lib/date'
import { LAMPORTS_PER_SOL, ASSET_META } from '@tenda/shared'
import type { UserEscrowTransaction, SupportedCurrency } from '@tenda/shared'

// Totals are SOL-denominated for the header card — only SOL-asset rows
// contribute (multi-asset totals would mix units; per-asset rows still
// show their own amounts in the feed).
const isSolTx = (tx: UserEscrowTransaction) =>
  (ASSET_META[tx.escrow.asset]?.symbol ?? tx.escrow.asset) === 'SOL'

/**
 * Wallet screen data controller — owns the SOL balance + transaction feed,
 * refresh state, and the SOL-denominated earned/spent lifetime totals.
 */
export function useWalletScreen() {
  const user          = useAuthStore((s) => s.user)
  const walletAddress = useAuthStore((s) => s.walletAddress)
  const rates         = useExchangeRateStore((s) => s.rates)
  const currency      = useSettingsStore((s) => s.currency) as SupportedCurrency

  const [balanceLamports, setBalanceLamports] = useState<number | null>(null)
  const [transactions, setTransactions]       = useState<UserEscrowTransaction[]>([])
  const [isLoading, setIsLoading]             = useState(true)
  const [refreshing, setRefreshing]           = useState(false)

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true)
    else setIsLoading(true)
    try {
      // Use allSettled so one failure (e.g. transient RPC error) doesn't
      // leave the screen stuck on the skeleton forever.
      await Promise.allSettled([
        walletAddress
          ? getBalance(new PublicKey(walletAddress))
              .then((b) => setBalanceLamports(b))
              .catch(() => setBalanceLamports(0))
          : Promise.resolve(setBalanceLamports(0)),
        user?.id
          ? api.users.transactions({ id: user.id })
              .then((r) => setTransactions(r.data))
              .catch(() => setTransactions([]))
          : Promise.resolve(setTransactions([])),
      ])
    } finally {
      if (isRefresh) setRefreshing(false)
      else setIsLoading(false)
    }
  }, [user?.id, walletAddress])

  useFocusEffect(
    useCallback(() => {
      if (!user?.id || !walletAddress) return
      load()
    }, [user?.id, walletAddress, load]),
  )

  const handleRefresh = useCallback(() => load(true), [load])

  const balanceSol = balanceLamports !== null ? balanceLamports / LAMPORTS_PER_SOL : null
  const rate = rates?.[currency] ?? null
  const balanceFiat = balanceSol !== null && rate !== null ? balanceSol * rate : null

  const earnedSol = transactions.reduce((sum, tx) => {
    if (!isSolTx(tx) || tx.escrow.counterparty_id !== user?.id) return sum
    if (tx.type === 'approve' || tx.type === 'claim_stalled' || (tx.type === 'resolve' && tx.winner === 'counterparty')) {
      const amount = Number(tx.amount_raw ?? '0') - Number(tx.platform_fee_raw ?? '0')
      return sum + amount / LAMPORTS_PER_SOL
    }
    return sum
  }, 0)

  const spentSol = transactions.reduce((sum, tx) => {
    if (!isSolTx(tx) || tx.escrow.creator_id !== user?.id || tx.type !== 'create') return sum
    return sum + Number(tx.amount_raw ?? tx.escrow.amount_raw) / LAMPORTS_PER_SOL
  }, 0)

  const feed = useMemo(
    () => groupByDay(transactions, (tx) => tx.created_at, (tx) => tx.id, 'tx'),
    [transactions],
  )

  return {
    user,
    walletAddress,
    currency,
    balanceSol,
    balanceFiat,
    earnedSol,
    spentSol,
    feed,
    isLoading,
    refreshing,
    handleRefresh,
  }
}
