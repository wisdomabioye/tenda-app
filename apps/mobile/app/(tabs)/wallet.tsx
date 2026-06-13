import { useState, useCallback, useMemo } from 'react'
import { View, FlatList, StyleSheet, RefreshControl, Pressable } from 'react-native'
import { useFocusEffect, useRouter } from 'expo-router'
import { useUnistyles } from 'react-native-unistyles'
import { PublicKey } from '@solana/web3.js'
import { Copy } from 'lucide-react-native'
import * as Clipboard from 'expo-clipboard'
import { typography } from '@/theme/tokens'
import { ScreenContainer, Text, Spacer, Header, showToast } from '@/components/ui'
import { RestrictionBanner } from '@/components/reputation'
import { Skeleton } from '@/components/ui/Skeleton'
import { useAuthStore } from '@/stores/auth.store'
import { FailedSyncPanel } from '@/components/sync/FailedSyncPanel'
import { TxRow } from '@/components/wallet'
import { api } from '@/api/client'
import { getBalance } from '@/wallet'
import { DevnetBadge } from '@/components/feedback'
import { useExchangeRateStore, useSettingsStore } from '@/stores'
import { formatFiat } from '@/lib/currency'
import { groupByDay } from '@/lib/date'
import { LAMPORTS_PER_SOL, truncateWallet , ASSET_META } from '@tenda/shared'
import type { UserEscrowTransaction, SupportedCurrency } from '@tenda/shared'


export default function WalletScreen() {
  const { theme } = useUnistyles()
  const router = useRouter()
  const user          = useAuthStore((s) => s.user)
  const walletAddress = useAuthStore((s) => s.walletAddress)
  const rates         = useExchangeRateStore((s) => s.rates)
  const currency      = useSettingsStore((s) => s.currency) as SupportedCurrency

  const [balanceLamports, setBalanceLamports] = useState<number | null>(null)
  const [transactions, setTransactions]       = useState<UserEscrowTransaction[]>([])
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
  }

  const handleRefresh = useCallback(() => load(true), [user?.id, walletAddress]) // eslint-disable-line react-hooks/exhaustive-deps

  const balanceSol = balanceLamports !== null ? balanceLamports / LAMPORTS_PER_SOL : null
  const rate = rates?.[currency] ?? null
  const balanceFiat = balanceSol !== null && rate !== null ? balanceSol * rate : null

  // Totals are SOL-denominated for the header card — only SOL-asset rows
  // contribute (multi-asset totals would mix units; per-asset rows still
  // show their own amounts in the feed).
  const isSolTx = (tx: UserEscrowTransaction) =>
    (ASSET_META[tx.escrow.asset]?.symbol ?? tx.escrow.asset) === 'SOL'

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

  const truncatedAddress = walletAddress ? truncateWallet(walletAddress) : null

  async function copyAddress() {
    if (!walletAddress) return
    await Clipboard.setStringAsync(walletAddress)
    showToast('success', 'Address copied')
  }

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

            {/* Hero card — total balance */}
            <View
              style={[
                s.hero,
                {
                  backgroundColor: theme.colors.brand.primarySurface,
                  borderColor: theme.colors.brand.primaryBorder,
                },
              ]}
            >
              {truncatedAddress && (
                <Pressable
                  onPress={copyAddress}
                  style={({ pressed }) => [
                    s.heroAddr,
                    { backgroundColor: theme.colors.surface.background },
                    pressed && { opacity: 0.7 },
                  ]}
                  accessibilityLabel="Copy wallet address"
                  accessibilityRole="button"
                >
                  <Text style={[s.heroAddrText, { color: theme.colors.content.tertiary }]}>
                    {truncatedAddress}
                  </Text>
                  <Copy size={11} color={theme.colors.content.tertiary} />
                </Pressable>
              )}

              <View style={s.heroLabelRow}>
                <Text style={[s.heroLabel, { color: theme.colors.content.tertiary }]}>
                  TOTAL BALANCE
                </Text>
                <DevnetBadge />
              </View>

              <View style={s.heroBalance}>
                <Text style={[s.heroGlyph, { color: theme.colors.content.tertiary }]}>◎</Text>
                {isLoading || balanceSol === null ? (
                  <Skeleton width={140} height={42} />
                ) : (
                  <>
                    <Text style={[s.heroAmount, { color: theme.colors.content.primary }]}>
                      {balanceSol.toFixed(2)}
                    </Text>
                    <Text style={[s.heroUnit, { color: theme.colors.content.tertiary }]}>SOL</Text>
                  </>
                )}
              </View>

              {balanceFiat !== null && (
                <Text style={[s.heroFiat, { color: theme.colors.content.tertiary }]}>
                  ≈ {formatFiat(balanceFiat, currency)}
                </Text>
              )}

              {/* Stage 8: Buy/Sell is a first-class wallet operation */}
              <Pressable
                onPress={() => router.push('/wallet/buy-sell' as Parameters<typeof router.push>[0])}
                style={({ pressed }) => [
                  s.buySell,
                  { backgroundColor: theme.colors.brand.primary },
                  pressed && { opacity: 0.85 },
                ]}
                accessibilityRole="button"
                accessibilityLabel="Buy or sell"
              >
                <Text style={[s.buySellText, { color: theme.colors.brand.onPrimary }]}>
                  Buy / Sell
                </Text>
              </Pressable>
            </View>

            {/* Earnings summary */}
            <View style={s.earnings}>
              <View
                style={[
                  s.statCard,
                  {
                    backgroundColor: theme.colors.surface.card,
                    borderColor: theme.colors.border.default,
                  },
                ]}
              >
                <View style={s.statLabelRow}>
                  <View style={[s.statDot, { backgroundColor: theme.colors.numeric.positive }]} />
                  <Text style={[s.statLabel, { color: theme.colors.content.tertiary }]} numberOfLines={1}>
                    EARNED
                  </Text>
                </View>
                <Text style={[s.statValue, { color: theme.colors.numeric.positive }]}>
                  + {earnedSol.toFixed(2)}
                </Text>
                <Text style={[s.statUnit, { color: theme.colors.content.tertiary }]}>
                  SOL · lifetime
                </Text>
              </View>
              <View
                style={[
                  s.statCard,
                  {
                    backgroundColor: theme.colors.surface.card,
                    borderColor: theme.colors.border.default,
                  },
                ]}
              >
                <View style={s.statLabelRow}>
                  <View style={[s.statDot, { backgroundColor: theme.colors.numeric.negative }]} />
                  <Text style={[s.statLabel, { color: theme.colors.content.tertiary }]} numberOfLines={1}>
                    SPENT
                  </Text>
                </View>
                <Text style={[s.statValue, { color: theme.colors.numeric.negative }]}>
                  − {spentSol.toFixed(2)}
                </Text>
                <Text style={[s.statUnit, { color: theme.colors.content.tertiary }]}>
                  SOL · lifetime
                </Text>
              </View>
            </View>

            {/* Section title */}
            <Text style={[s.sectionTitle, { color: theme.colors.content.tertiary }]}>
              TRANSACTION HISTORY
            </Text>
          </>
        }
        renderItem={({ item }) =>
          item.type === 'day' ? (
            <Text style={[s.dayHeader, { color: theme.colors.content.tertiary }]}>
              {item.label.toUpperCase()}
            </Text>
          ) : (
            <TxRow tx={item.item} userId={user?.id ?? ''} />
          )
        }
        ListEmptyComponent={
          !isLoading ? (
            <Text size={13} color={theme.colors.content.tertiary} style={s.emptyText}>
              No transactions yet
            </Text>
          ) : null
        }
        ListFooterComponent={<Spacer size={32} />}
      />
    </ScreenContainer>
  )
}

const s = StyleSheet.create({
  content: {
    paddingTop: 4,
  },
  hero: {
    marginHorizontal: 20,
    marginTop: 12,
    height: 148,
    borderRadius: 22,
    borderWidth: 1,
    paddingHorizontal: 20,
    paddingVertical: 18,
    overflow: 'hidden',
    position: 'relative',
  },
  heroAddr: {
    position: 'absolute',
    top: 18,
    right: 18,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  heroAddrText: {
    fontFamily: typography.fonts.mono,
    fontSize: 11,
    lineHeight: 14,
    letterSpacing: 0.11,
  },
  heroLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  heroLabel: {
    fontFamily: typography.fonts.mono,
    fontSize: 10,
    lineHeight: 13,
    fontWeight: '600',
    letterSpacing: 1.0,
  },
  heroBalance: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
    marginTop: 8,
  },
  heroGlyph: {
    fontFamily: typography.fonts.mono,
    fontSize: 20,
    lineHeight: 22,
  },
  heroAmount: {
    fontFamily: typography.fonts.mono,
    fontSize: 40,
    lineHeight: 42,
    fontWeight: '700',
    letterSpacing: -0.8,
  },
  heroUnit: {
    fontFamily: typography.fonts.mono,
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '500',
  },
  buySell: {
    marginTop: 12,
    alignSelf: 'stretch',
    alignItems: 'center',
    paddingVertical: 10,
    borderRadius: 12,
  },
  buySellText: {
    fontSize: 14,
    fontFamily: typography.fonts.body.semibold,
  },
  heroFiat: {
    fontFamily: typography.fonts.mono,
    fontSize: 13,
    lineHeight: 17,
    marginTop: 6,
  },
  earnings: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 4,
  },
  statCard: {
    flex: 1,
    borderRadius: 18,
    borderWidth: 1,
    padding: 14,
  },
  statLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statLabel: {
    fontFamily: typography.fonts.mono,
    fontSize: 10,
    lineHeight: 13,
    fontWeight: '600',
    letterSpacing: 0.8,
    flexShrink: 1,
    includeFontPadding: false,
  },
  statValue: {
    fontFamily: typography.fonts.mono,
    fontSize: 20,
    lineHeight: 24,
    fontWeight: '700',
    letterSpacing: -0.4,
    marginTop: 6,
  },
  statUnit: {
    fontFamily: typography.fonts.mono,
    fontSize: 10,
    lineHeight: 13,
    marginTop: 2,
  },
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
  emptyText: {
    textAlign: 'center',
    paddingVertical: 24,
  },
})
