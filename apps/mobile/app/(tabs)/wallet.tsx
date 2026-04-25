import { useState, useCallback } from 'react'
import { View, FlatList, StyleSheet, RefreshControl } from 'react-native'
import { useFocusEffect } from 'expo-router'
import { useUnistyles } from 'react-native-unistyles'
import { PublicKey } from '@solana/web3.js'
import { spacing, radius, shadows, typography } from '@/theme/tokens'
import { ScreenContainer, Text, Spacer, Card, Header } from '@/components/ui'
import { Skeleton } from '@/components/ui/Skeleton'
import { useAuthStore } from '@/stores/auth.store'
import { FailedSyncPanel } from '@/components/sync/FailedSyncPanel'
import { TxRow } from '@/components/wallet'

import { api } from '@/api/client'
import { getBalance } from '@/wallet'
import { formatSol } from '@/lib/currency'
import { DevnetBadge } from '@/components/feedback'
import type { UserTransaction } from '@tenda/shared'

const LAMPORTS_PER_SOL = 1_000_000_000

export default function WalletScreen() {
  const { theme } = useUnistyles()
  const user          = useAuthStore((s) => s.user)
  const walletAddress = useAuthStore((s) => s.walletAddress)

  const [balanceLamports, setBalanceLamports] = useState<number | null>(null)
  const [transactions, setTransactions]       = useState<UserTransaction[]>([])
  const [isLoading, setIsLoading]             = useState(true)
  const [refreshing, setRefreshing]           = useState(false)

  useFocusEffect(
    useCallback(() => {
      if (!user?.id || !walletAddress) return
      load()
    }, [user?.id, walletAddress]), // eslint-disable-line react-hooks/exhaustive-deps
  )

  async function load(isRefresh = false) {
    if (isRefresh) setRefreshing(true)
    else setIsLoading(true)
    try {
      await Promise.all([
        walletAddress
          ? getBalance(new PublicKey(walletAddress)).then((b) => setBalanceLamports(b))
          : Promise.resolve(),
        user?.id
          ? api.users.transactions({ id: user.id }).then((r) => setTransactions(r.data))
          : Promise.resolve(),
      ])
    } finally {
      if (isRefresh) setRefreshing(false)
      else setIsLoading(false)
    }
  }

  const handleRefresh = useCallback(() => load(true), [user?.id, walletAddress]) // eslint-disable-line react-hooks/exhaustive-deps

  const balanceSol = balanceLamports !== null ? balanceLamports / LAMPORTS_PER_SOL : null

  // Earned: worker's gig payouts + buyer's exchange SOL receipts
  const earnedLamports = transactions.reduce((sum, tx) => {
    if (tx.source === 'gig') {
      if (tx.gig.worker_id !== user?.id) return sum
      if (tx.type === 'release_payment') return sum + tx.amount_lamports - tx.platform_fee_lamports
      if (tx.type === 'dispute_resolved') return sum + tx.amount_lamports - tx.platform_fee_lamports
    } else {
      if (tx.offer.buyer_id !== user?.id) return sum
      if (tx.type === 'release_payment') return sum + tx.amount_lamports - tx.platform_fee_lamports
    }
    return sum
  }, 0)

  // Spent: poster's gig escrow funding + seller's exchange escrow funding
  const spentLamports = transactions.reduce((sum, tx) => {
    if (tx.source === 'gig'      && tx.gig.poster_id    === user?.id && tx.type === 'create_escrow') return sum + tx.amount_lamports
    if (tx.source === 'exchange' && tx.offer.seller_id  === user?.id && tx.type === 'create_escrow') return sum + tx.amount_lamports
    return sum
  }, 0)

  return (
    <ScreenContainer scroll={false} padding={false} edges={['left', 'right']}>
      <Header title="Wallet" showBack />
      <FlatList
        data={transactions}
        keyExtractor={(item) => item.id}
        contentContainerStyle={s.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={theme.colors.brand.primary}
            colors={[theme.colors.brand.primary]}
          />
        }
        ListHeaderComponent={
          <>
            <FailedSyncPanel />

            {/* Balance card */}
            <Card variant="filled" padding={spacing.md}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Text variant="caption" color={theme.colors.content.secondary}>SOL Balance</Text>
                <DevnetBadge />
              </View>
              {isLoading || balanceSol === null ? (
                <View style={{ marginTop: 4 }}><Skeleton width={120} height={28} /></View>
              ) : (
                <Text weight="bold" size={typography.styles.h2.fontSize} color={theme.colors.utility.money}>
                  {balanceSol.toFixed(4)} SOL
                </Text>
              )}
              <Text variant="caption" color={theme.colors.content.tertiary} style={{ marginTop: 4 }}>
                {walletAddress
                  ? `${walletAddress.slice(0, 6)}...${walletAddress.slice(-6)}`
                  : '—'}
              </Text>
            </Card>

            <Spacer size={spacing.md} />

            {/* Earnings summary */}
            <View style={s.summaryRow}>
              <View style={[s.summaryCard, { backgroundColor: theme.colors.surface.card }]}>
                <Text variant="caption" color={theme.colors.content.secondary} weight="semibold">Earned</Text>
                <Text weight="bold" size={typography.styles.body.fontSize} color={theme.colors.feedback.success.text}>
                  {formatSol(earnedLamports)}
                </Text>
              </View>
              <View style={[s.summaryCard, { backgroundColor: theme.colors.surface.card }]}>
                <Text variant="caption" color={theme.colors.content.secondary} weight="semibold">Spent</Text>
                <Text weight="bold" size={typography.styles.body.fontSize} color={theme.colors.feedback.danger.text}>
                  {formatSol(spentLamports)}
                </Text>
              </View>
            </View>

            <Spacer size={spacing.md} />
            <Text variant="subheading">Transaction History</Text>
            <Spacer size={spacing.md} />
          </>
        }
        renderItem={({ item }) => (
          <TxRow tx={item} userId={user?.id ?? ''} />
        )}
        ListEmptyComponent={
          !isLoading ? (
            <Text variant="caption" color={theme.colors.content.tertiary} align="center">
              No transactions yet
            </Text>
          ) : null
        }
        ListFooterComponent={<Spacer size={spacing.xl} />}
      />
    </ScreenContainer>
  )
}

const s = StyleSheet.create({
  content: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
  },
  summaryRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  summaryCard: {
    flex: 1,
    padding: spacing.sm,
    borderRadius: radius.lg,
    gap: 2,
    ...shadows.card,
  },
  txRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.xs,
    borderBottomWidth: 1,
  },
  txLeft: {
    flex: 1,
    gap: 1,
    paddingRight: spacing.sm,
  },
})
