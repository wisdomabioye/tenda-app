import { useRef, useCallback, useState } from 'react'
import {
  View, FlatList, ActivityIndicator, StyleSheet, RefreshControl,
  ScrollView, Animated, Pressable, useWindowDimensions,
} from 'react-native'
import type { NativeSyntheticEvent, NativeScrollEvent } from 'react-native'
import { useRouter, useFocusEffect } from 'expo-router'
import { useUnistyles } from 'react-native-unistyles'
import { SlidersHorizontal, Check, X } from 'lucide-react-native'
import { spacing, radius } from '@/theme/tokens'
import { 
  ScreenContainer, 
  Text, Spacer, EmptyState, 
  Button, Header, BottomSheet,
  Skeleton 
} from '@/components/ui'
import { ExchangeOfferCard } from '@/components/exchange'
import { usePeerExchangeStore } from '@/stores/p2p-exchange.store'
import { useAuthStore } from '@/stores/auth.store'
import { api } from '@/api/client'
import { SUPPORTED_CURRENCIES } from '@tenda/shared'
import type { ExchangeOfferSummary } from '@tenda/shared'

export default function ExchangeScreen() {
  const router             = useRouter()
  const { theme }          = useUnistyles()
  const { width: SW }      = useWindowDimensions()
  const user               = useAuthStore((s) => s.user)

  const { offers, isLoading, isLoadingMore, hasFetched, error, fetchOffers, loadMore, setFilters, resetFilters } =
    usePeerExchangeStore()

  const [pageIndex, setPageIndex]               = useState(0)
  const [currency, setCurrency]                 = useState<string | null>(null)
  const [currencySheetOpen, setCurrencySheetOpen] = useState(false)
  const [refreshing, setRefreshing]             = useState(false)
  const [myOffers, setMyOffers]                 = useState<ExchangeOfferSummary[]>([])
  const [isLoadingMine, setIsLoadingMine]       = useState(false)

  const scrollRef = useRef<ScrollView>(null)
  const scrollX   = useRef(new Animated.Value(0)).current

  // Underline slides from 0 → SW/2 as the pager moves from page 0 → page 1
  const underlineX = scrollX.interpolate({
    inputRange: [0, SW],
    outputRange: [0, SW / 2],
    extrapolate: 'clamp',
  })

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
    if (pageIndex === 1) loadMyOffers()
    else fetchOffers()
  }, [pageIndex])) // eslint-disable-line react-hooks/exhaustive-deps

  async function handleRefresh() {
    setRefreshing(true)
    if (pageIndex === 1) await loadMyOffers()
    else await fetchOffers()
    setRefreshing(false)
  }

  function scrollToPage(index: number) {
    setPageIndex(index)
    scrollRef.current?.scrollTo({ x: index * SW, animated: true })
    if (index === 1) { setCurrency(null); resetFilters(); loadMyOffers() }
  }

  function handleScrollEnd(e: NativeSyntheticEvent<NativeScrollEvent>) {
    const index = Math.round(e.nativeEvent.contentOffset.x / SW)
    if (index === pageIndex) return
    setPageIndex(index)
    if (index === 1) { setCurrency(null); resetFilters(); loadMyOffers() }
  }

  function handleCurrencySelect(cur: string) {
    const next = currency === cur ? null : cur
    setCurrency(next)
    setFilters({ currency: next ?? undefined })
    setCurrencySheetOpen(false)
  }

  const showMarketSkeleton = !hasFetched && isLoading
  const showMineSkeleton   = isLoadingMine && myOffers.length === 0

  return (
    <ScreenContainer scroll={false} padding={false}>
      {/* ── Header ── */}
      <Header title="Trade" showBack />

      {/* ── Tab row + animated underline ── */}
      <View style={[s.tabRow, { borderBottomColor: theme.colors.borderFaint }]}>
        {(['Market', 'My Offers'] as const).map((label, i) => (
          <Pressable key={label} style={s.tab} onPress={() => scrollToPage(i)}>
            <Text
              weight="semibold"
              size={15}
              color={pageIndex === i ? theme.colors.primary : theme.colors.textSub}
            >
              {label}
            </Text>
          </Pressable>
        ))}
        <Animated.View
          style={[s.underline, { backgroundColor: theme.colors.primary, transform: [{ translateX: underlineX }] }]}
        />
      </View>

      {/* ── Swipeable pages ── */}
      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        scrollEventThrottle={16}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { x: scrollX } } }],
          { useNativeDriver: false },
        )}
        onMomentumScrollEnd={handleScrollEnd}
        style={s.pager}
      >
        {/* Page 0 — Market */}
        <View style={{ width: SW }}>
          {/* Currency filter pill */}
          <View style={[s.filterRow, { borderBottomColor: theme.colors.borderFaint }]}>
            <Pressable
              style={[s.filterBtn, { backgroundColor: theme.colors.muted }]}
              onPress={() => setCurrencySheetOpen(true)}
            >
              <SlidersHorizontal size={13} color={theme.colors.textSub} />
              <Text variant="caption" weight="medium" color={theme.colors.textSub}>
                {currency ?? 'All currencies'}
              </Text>
            </Pressable>
            {currency && (
              <Pressable hitSlop={8} onPress={() => { setCurrency(null); resetFilters() }}>
                <X size={16} color={theme.colors.textSub} />
              </Pressable>
            )}
          </View>

          {showMarketSkeleton ? (
            <View style={s.skeletonWrap}>
              {[0, 1, 2].map((i) => (
                <View key={i} style={s.skeletonCard}><Skeleton width="100%" height={110} radius={12} /></View>
              ))}
            </View>
          ) : error ? (
            <View style={s.center}>
              <Text color={theme.colors.danger}>{error}</Text>
              <Spacer size={spacing.sm} />
              <Button variant="outline" size="sm" onPress={fetchOffers}>Retry</Button>
            </View>
          ) : (
            <FlatList
              data={offers}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => <ExchangeOfferCard offer={item} showStatus={false} />}
              contentContainerStyle={s.list}
              ItemSeparatorComponent={() => <View style={{ height: spacing.sm }} />}
              refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={theme.colors.primary} />}
              onEndReached={loadMore}
              onEndReachedThreshold={0.3}
              ListFooterComponent={isLoadingMore ? <ActivityIndicator style={s.footer} color={theme.colors.primary} /> : null}
              ListEmptyComponent={
                <EmptyState
                  title="No open offers"
                  description={currency ? `No open ${currency} offers right now` : 'Check back soon for new offers'}
                />
              }
            />
          )}
        </View>

        {/* Page 1 — My Offers */}
        <View style={{ width: SW }}>
          {showMineSkeleton ? (
            <View style={s.skeletonWrap}>
              {[0, 1, 2].map((i) => (
                <View key={i} style={s.skeletonCard}><Skeleton width="100%" height={110} radius={12} /></View>
              ))}
            </View>
          ) : (
            <FlatList
              data={myOffers}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => <ExchangeOfferCard offer={item} showStatus />}
              contentContainerStyle={s.list}
              ItemSeparatorComponent={() => <View style={{ height: spacing.sm }} />}
              refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={theme.colors.primary} />}
              ListEmptyComponent={
                <EmptyState
                  title="No offers yet"
                  description='Tap "Sell SOL" to post your first offer'
                />
              }
            />
          )}
        </View>
      </ScrollView>

      {/* ── Currency picker ── */}
      <BottomSheet
        visible={currencySheetOpen}
        onClose={() => setCurrencySheetOpen(false)}
        title="Filter by currency"
      >
        {SUPPORTED_CURRENCIES.map((cur) => (
          <Pressable
            key={cur}
            onPress={() => handleCurrencySelect(cur)}
            style={[s.currencyOption, { borderBottomColor: theme.colors.borderFaint }]}
          >
            <Text
              weight={currency === cur ? 'semibold' : 'regular'}
              color={currency === cur ? theme.colors.primary : theme.colors.text}
            >
              {cur}
            </Text>
            {currency === cur && <Check size={16} color={theme.colors.primary} />}
          </Pressable>
        ))}
      </BottomSheet>
    </ScreenContainer>
  )
}

const s = StyleSheet.create({
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.md, paddingTop: spacing.lg, paddingBottom: spacing.sm, borderBottomWidth: 1,
  },
  tabRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 14,
  },
  underline: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    width: '50%',
    height: 2,
  },
  pager: { flex: 1 },
  filterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
  },
  filterBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: 6,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.full,
  },
  list:         { padding: spacing.md, paddingBottom: spacing['2xl'] },
  skeletonWrap: { padding: spacing.md },
  skeletonCard: { marginBottom: spacing.sm },
  center:       { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
  footer:       { paddingVertical: spacing.md },
  currencyOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
  },
})
