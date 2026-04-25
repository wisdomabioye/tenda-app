import { useState, useCallback, useMemo } from 'react'
import { View, FlatList, StyleSheet, RefreshControl, Pressable } from 'react-native'
import { useFocusEffect } from 'expo-router'
import { useUnistyles } from 'react-native-unistyles'
import { PublicKey } from '@solana/web3.js'
import { Copy } from 'lucide-react-native'
import * as Clipboard from 'expo-clipboard'
import { typography } from '@/theme/tokens'
import { ScreenContainer, Text, Spacer, Header, showToast } from '@/components/ui'
import { Skeleton } from '@/components/ui/Skeleton'
import { useAuthStore } from '@/stores/auth.store'
import { FailedSyncPanel } from '@/components/sync/FailedSyncPanel'
import { TxRow } from '@/components/wallet'
import { api } from '@/api/client'
import { getBalance } from '@/wallet'
import { DevnetBadge } from '@/components/feedback'
import { useExchangeRateStore, useSettingsStore } from '@/stores'
import { formatFiat } from '@/lib/currency'
import type { UserTransaction, SupportedCurrency } from '@tenda/shared'

const LAMPORTS_PER_SOL = 1_000_000_000

type FeedItem =
  | { type: 'day'; key: string; label: string }
  | { type: 'tx'; key: string; tx: UserTransaction }

function formatDayLabel(iso: string): string {
  const date = new Date(iso)
  const now = new Date()
  if (date.toDateString() === now.toDateString()) return 'Today'
  const yesterday = new Date(now)
  yesterday.setDate(yesterday.getDate() - 1)
  if (date.toDateString() === yesterday.toDateString()) return 'Yesterday'
  if (date.getFullYear() === now.getFullYear()) {
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' })
  }
  return date.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })
}

export default function WalletScreen() {
  const { theme } = useUnistyles()
  const user          = useAuthStore((s) => s.user)
  const walletAddress = useAuthStore((s) => s.walletAddress)
  const rates         = useExchangeRateStore((s) => s.rates)
  const currency      = useSettingsStore((s) => s.currency) as SupportedCurrency

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
  const rate = rates?.[currency] ?? null
  const balanceFiat = balanceSol !== null && rate !== null ? balanceSol * rate : null

  const earnedSol = transactions.reduce((sum, tx) => {
    if (tx.source === 'gig') {
      if (tx.gig.worker_id !== user?.id) return sum
      if (tx.type === 'release_payment' || tx.type === 'dispute_resolved') {
        return sum + (tx.amount_lamports - tx.platform_fee_lamports) / LAMPORTS_PER_SOL
      }
    } else {
      if (tx.offer.buyer_id !== user?.id) return sum
      if (tx.type === 'release_payment') {
        return sum + (tx.amount_lamports - tx.platform_fee_lamports) / LAMPORTS_PER_SOL
      }
    }
    return sum
  }, 0)

  const spentSol = transactions.reduce((sum, tx) => {
    if (tx.source === 'gig'      && tx.gig.poster_id   === user?.id && tx.type === 'create_escrow') return sum + tx.amount_lamports / LAMPORTS_PER_SOL
    if (tx.source === 'exchange' && tx.offer.seller_id === user?.id && tx.type === 'create_escrow') return sum + tx.amount_lamports / LAMPORTS_PER_SOL
    return sum
  }, 0)

  // Day-grouped feed: insert section headers when calendar date changes.
  const feed: FeedItem[] = useMemo(() => {
    const out: FeedItem[] = []
    let lastDay: string | null = null
    for (const tx of transactions) {
      if (!tx.created_at) continue
      const day = new Date(tx.created_at).toDateString()
      if (day !== lastDay) {
        out.push({ type: 'day', key: `day-${day}`, label: formatDayLabel(tx.created_at) })
        lastDay = day
      }
      out.push({ type: 'tx', key: tx.id, tx })
    }
    return out
  }, [transactions])

  const truncatedAddress = walletAddress
    ? `${walletAddress.slice(0, 4)}…${walletAddress.slice(-4)}`
    : null

  async function copyAddress() {
    if (!walletAddress) return
    await Clipboard.setStringAsync(walletAddress)
    showToast('success', 'Address copied')
  }

  return (
    <ScreenContainer scroll={false} padding={false} edges={['left', 'right']}>
      <Header title="Wallet" variant="large" />
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
                  <Text style={[s.statLabel, { color: theme.colors.content.tertiary }]}>
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
                  <Text style={[s.statLabel, { color: theme.colors.content.tertiary }]}>
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
            <TxRow tx={item.tx} userId={user?.id ?? ''} />
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
