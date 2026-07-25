import { ActivityIndicator, FlatList, StyleSheet, RefreshControl } from 'react-native'
import { useUnistyles } from 'react-native-unistyles'
import { typography } from '@/theme/tokens'
import { ScreenContainer, Text, Spacer, Header } from '@/components/ui'
import { RestrictionBanner } from '@/components/reputation'
import { FailedSyncPanel } from '@/components/sync/FailedSyncPanel'
import {
  TxRow,
  WalletHeroCard,
  EarningsSummary,
  WalletBalanceRows,
  WalletActions,
  WalletEmptyState,
  WalletLoadError,
} from '@/components/wallet'
import { useWalletScreen } from '@/hooks/useWalletScreen'
import { END_REACHED_THRESHOLD } from '@/lib/pagination'

export default function WalletScreen() {
  const { theme } = useUnistyles()
  const {
    user,
    hasWallet,
    walletsStatus,
    retryWallets,
    balances,
    totalUsdc,
    earnedUsdc,
    spentUsdc,
    feed,
    loadMoreTransactions,
    isLoadingMoreTransactions,
    isLoading,
    isLoadingTransactions,
    refreshing,
    handleRefresh,
  } = useWalletScreen()

  // A failed load must NOT read as "no wallet linked" (that was the bug). Only
  // a settled `ready` load with an empty list is genuinely wallet-less; while
  // loading, the hero skeleton stands in.
  const walletSection = hasWallet ? (
    <>
      <WalletHeroCard totalUsdc={totalUsdc} isLoading={isLoading} />
      <WalletBalanceRows balances={balances} />
      <WalletActions />
      <EarningsSummary earnedUsdc={earnedUsdc} spentUsdc={spentUsdc} />
    </>
  ) : walletsStatus === 'error' ? (
    <WalletLoadError onRetry={retryWallets} />
  ) : walletsStatus === 'ready' ? (
    <WalletEmptyState />
  ) : (
    <WalletHeroCard totalUsdc={totalUsdc} isLoading />
  )

  return (
    <ScreenContainer scroll={false} padding={false} edges={['left', 'right']}>
      <Header title="Wallet" variant="large" />
      <RestrictionBanner />
      <FlatList
        data={feed}
        keyExtractor={(item) => item.key}
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
            {walletSection}
            <Text style={[s.sectionTitle, { color: theme.colors.content.tertiary }]}>TRANSACTION HISTORY</Text>
          </>
        }
        renderItem={({ item }) =>
          item.type === 'day' ? (
            <Text style={[s.dayHeader, { color: theme.colors.content.tertiary }]}>{item.label.toUpperCase()}</Text>
          ) : (
            <TxRow tx={item.item} userId={user?.id ?? ''} />
          )
        }
        ListEmptyComponent={
          // Gated on the FEED's own load, not just `isLoading` (balances +
          // totals): the summary is the cheaper request and routinely settles
          // first, which used to flash "No transactions yet" over a feed that
          // was still fetching.
          !isLoading && !isLoadingTransactions ? (
            <Text size={13} color={theme.colors.content.tertiary} style={s.emptyText}>
              No transactions yet
            </Text>
          ) : null
        }
        onEndReached={loadMoreTransactions}
        onEndReachedThreshold={END_REACHED_THRESHOLD}
        ListFooterComponent={
          isLoadingMoreTransactions ? (
            <ActivityIndicator style={s.footer} color={theme.colors.brand.primary} />
          ) : (
            <Spacer size={32} />
          )
        }
      />
    </ScreenContainer>
  )
}

const s = StyleSheet.create({
  content: { paddingTop: 4 },
  footer: { paddingVertical: 16 },
  sectionTitle: {
    fontFamily: typography.fonts.mono,
    fontSize: 10,
    lineHeight: 13,
    fontWeight: '600',
    letterSpacing: 1.0,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 8,
  },
  dayHeader: {
    fontFamily: typography.fonts.mono,
    fontSize: 10,
    lineHeight: 13,
    fontWeight: '600',
    letterSpacing: 1.0,
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 6,
  },
  emptyText: { textAlign: 'center', paddingVertical: 24 },
})
