import { useCallback, useState } from 'react'
import { View, FlatList, ActivityIndicator, StyleSheet, RefreshControl, ScrollView } from 'react-native'
import { useRouter, useFocusEffect } from 'expo-router'
import { useUnistyles } from 'react-native-unistyles'
import { Plus } from 'lucide-react-native'
import { spacing, typography } from '@/theme/tokens'
import { ScreenContainer, Text, Spacer, EmptyState, Button } from '@/components/ui'
import { Chip } from '@/components/ui/Chip'
import { Skeleton } from '@/components/ui/Skeleton'
import { ExchangeOfferCard } from '@/components/exchange'
import { usePeerExchangeStore } from '@/stores/p2p-exchange.store'
import { useAuthStore } from '@/stores/auth.store'
import { api } from '@/api/client'
import { SUPPORTED_CURRENCIES } from '@tenda/shared'
import type { ExchangeOfferSummary } from '@tenda/shared'

type TabView = 'market' | 'mine'

export default function ExchangeScreen() {
  const router    = useRouter()
  const { theme } = useUnistyles()
  const user      = useAuthStore((s) => s.user)

  const { offers, isLoading, isLoadingMore, hasFetched, error, fetchOffers, loadMore, setFilters, resetFilters } =
    usePeerExchangeStore()

  const [view, setView]               = useState<TabView>('market')
  const [currency, setCurrency]       = useState<string | null>(null)
  const [refreshing, setRefreshing]   = useState(false)
  const [myOffers, setMyOffers]       = useState<ExchangeOfferSummary[]>([])
  const [isLoadingMine, setIsLoadingMine] = useState(false)

  async function loadMyOffers() {
    if (!user) return
    setIsLoadingMine(true)
    try {
      const result = await api.users.exchangeOffers({ id: user.id })
      setMyOffers(result.data)
    } catch {
      // Non-fatal — list stays stale
    } finally {
      setIsLoadingMine(false)
    }
  }

  useFocusEffect(useCallback(() => {
    if (view === 'mine') {
      loadMyOffers()
    } else {
      fetchOffers()
    }
  }, [view])) // eslint-disable-line react-hooks/exhaustive-deps

  async function handleRefresh() {
    setRefreshing(true)
    if (view === 'mine') {
      await loadMyOffers()
    } else {
      await fetchOffers()
    }
    setRefreshing(false)
  }

  function handleCurrencyFilter(cur: string) {
    const next = currency === cur ? null : cur
    setCurrency(next)
    setFilters({ currency: next ?? undefined })
  }

  function handleViewToggle(v: TabView) {
    setView(v)
    if (v === 'mine') {
      setCurrency(null)
      resetFilters()
      loadMyOffers()
    } else {
      resetFilters()
      setCurrency(null)
    }
  }

  const displayedOffers: ExchangeOfferSummary[] = view === 'mine' ? myOffers : offers

  const showSkeleton = view === 'mine'
    ? isLoadingMine && myOffers.length === 0
    : !hasFetched && isLoading

  return (
    <ScreenContainer scroll={false} padding={false}>
      {/* Header */}
      <View style={[s.header, { borderBottomColor: theme.colors.borderFaint }]}>
        <Text weight="bold" size={typography.sizes.xl} style={{ letterSpacing: -0.5 }}>Trade</Text>
        <Button
          variant="primary"
          size="sm"
          icon={<Plus size={14} color={theme.colors.onPrimary} strokeWidth={2.5} />}
          onPress={() => router.push('/exchange/create' as any)}
        >
          Sell SOL
        </Button>
      </View>

      {/* Market / My Offers toggle */}
      <View style={[s.toggleRow, { borderBottomColor: theme.colors.borderFaint }]}>
        <Chip label="Market"    selected={view === 'market'} onPress={() => handleViewToggle('market')} />
        <Chip label="My Offers" selected={view === 'mine'}   onPress={() => handleViewToggle('mine')} />
      </View>

      {/* Currency filter — market only */}
      {view === 'market' && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.currencyRow}>
          {SUPPORTED_CURRENCIES.map((cur) => (
            <Chip key={cur} label={cur} selected={currency === cur} onPress={() => handleCurrencyFilter(cur)} />
          ))}
        </ScrollView>
      )}

      {/* List */}
      {showSkeleton ? (
        <View style={s.skeletonWrap}>
          {[0, 1, 2].map((i) => (
            <View key={i} style={s.skeletonCard}>
              <Skeleton width="100%" height={110} radius={12} />
            </View>
          ))}
        </View>
      ) : error && view === 'market' ? (
        <View style={s.center}>
          <Text color={theme.colors.danger}>{error}</Text>
          <Spacer size={spacing.sm} />
          <Button variant="outline" size="sm" onPress={fetchOffers}>Retry</Button>
        </View>
      ) : (
        <FlatList
          data={displayedOffers}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <ExchangeOfferCard offer={item} showStatus={view === 'mine'} />}
          contentContainerStyle={s.list}
          ItemSeparatorComponent={() => <View style={{ height: spacing.sm }} />}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={theme.colors.primary} />}
          onEndReached={() => { if (view === 'market') loadMore() }}
          onEndReachedThreshold={0.3}
          ListFooterComponent={isLoadingMore ? <ActivityIndicator style={s.footer} color={theme.colors.primary} /> : null}
          ListEmptyComponent={
            <EmptyState
              title={view === 'mine' ? 'No offers yet' : 'No open offers'}
              description={
                view === 'mine'
                  ? 'Tap "Sell SOL" to post your first offer'
                  : currency
                    ? `No open ${currency} offers right now`
                    : 'Check back soon for new offers'
              }
            />
          }
        />
      )}
    </ScreenContainer>
  )
}

const s = StyleSheet.create({
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.md, paddingTop: spacing.lg, paddingBottom: spacing.sm, borderBottomWidth: 1,
  },
  toggleRow: {
    flexDirection: 'row', gap: spacing.sm,
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderBottomWidth: 1,
  },
  currencyRow: {
    flexDirection: 'row', gap: spacing.sm,
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
  },
  list:        { padding: spacing.md, paddingBottom: spacing['2xl'] },
  skeletonWrap:{ padding: spacing.md },
  skeletonCard:{ marginBottom: spacing.sm },
  center:      { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
  footer:      { paddingVertical: spacing.md },
})
