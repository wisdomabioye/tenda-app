import { useRef, useCallback, useState } from 'react'
import { View, StyleSheet, ScrollView, Animated, Pressable, useWindowDimensions } from 'react-native'
import type { NativeSyntheticEvent, NativeScrollEvent } from 'react-native'
import { useFocusEffect, useRouter } from 'expo-router'
import { useUnistyles } from 'react-native-unistyles'
import { Plus } from 'lucide-react-native'
import { ScreenContainer, Text, Header } from '@/components/ui'
import {
  ExchangeMarketPage,
  ExchangeMyOffersPage,
  CurrencyFilterSheet,
} from '@/components/exchange'
import { useExchangeMarketStore, useAuthStore } from '@/stores'
import { api } from '@/api/client'
import type { EscrowListRow } from '@tenda/shared'

export default function ExchangeScreen() {
  const { theme }     = useUnistyles()
  const { width: SW } = useWindowDimensions()
  const router        = useRouter()
  const user          = useAuthStore((s) => s.user)

  const { offers, isLoading, isLoadingMore, hasFetched, error, fetchOffers, loadMore, setFilters, resetFilters } =
    useExchangeMarketStore()

  const [pageIndex, setPageIndex]                 = useState(0)
  const [currency, setCurrency]                   = useState<string | null>(null)
  const [currencySheetOpen, setCurrencySheetOpen] = useState(false)
  const [refreshing, setRefreshing]               = useState(false)
  const [myOffers, setMyOffers]                   = useState<EscrowListRow[]>([])
  const [isLoadingMine, setIsLoadingMine]         = useState(false)

  const scrollRef = useRef<ScrollView>(null)
  const scrollX   = useRef(new Animated.Value(0)).current

  // Underline slides from 0 → SW/2 as the pager moves from page 0 → page 1
  const underlineX = scrollX.interpolate({ inputRange: [0, SW], outputRange: [0, SW / 2], extrapolate: 'clamp' })

  const loadMyOffers = useCallback(async () => {
    if (!user) return
    setIsLoadingMine(true)
    try {
      // No role filter → both sides: offers posted (creator) and offers
      // accepted (counterparty). The row derives selling/buying from creator_id.
      const result = await api.users.escrows({ id: user.id }, { kind: 'exchange' })
      setMyOffers(result.data)
    } catch {
      // Non-fatal, list stays stale
    } finally {
      setIsLoadingMine(false)
    }
  }, [user])

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

  function goToMine() {
    setCurrency(null)
    resetFilters()
    loadMyOffers()
  }

  function scrollToPage(index: number) {
    setPageIndex(index)
    scrollRef.current?.scrollTo({ x: index * SW, animated: true })
    if (index === 1) goToMine()
  }

  function handleScrollEnd(e: NativeSyntheticEvent<NativeScrollEvent>) {
    const index = Math.round(e.nativeEvent.contentOffset.x / SW)
    if (index === pageIndex) return
    setPageIndex(index)
    if (index === 1) goToMine()
  }

  function handleCurrencySelect(cur: string) {
    const next = currency === cur ? null : cur
    setCurrency(next)
    setFilters({ currency: next ?? undefined })
    setCurrencySheetOpen(false)
  }

  return (
    <ScreenContainer scroll={false} padding={false}>
      <Header
        variant="large"
        title="Trade"
        subtitle="Swap crypto with sellers"
        // Post a P2P sell offer — available to all users (the create screen
        // gates on having a linked wallet, not on advanced mode).
        rightIcon={Plus}
        onRightPress={() => router.push('/wallet/buy-sell?mode=offer' as Parameters<typeof router.push>[0])}
      />

      {/* Tab row + animated underline */}
      <View style={[s.tabRow, { borderBottomColor: theme.colors.border.subtle }]}>
        {(['Market', 'My Trades'] as const).map((label, i) => (
          <Pressable key={label} style={s.tab} onPress={() => scrollToPage(i)}>
            <Text
              weight="semibold"
              size={15}
              color={pageIndex === i ? theme.colors.brand.primary : theme.colors.content.secondary}
            >
              {label}
            </Text>
          </Pressable>
        ))}
        <Animated.View
          style={[s.underline, { backgroundColor: theme.colors.brand.primary, transform: [{ translateX: underlineX }] }]}
        />
      </View>

      {/* Swipeable pages */}
      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        scrollEventThrottle={16}
        onScroll={Animated.event([{ nativeEvent: { contentOffset: { x: scrollX } } }], { useNativeDriver: false })}
        onMomentumScrollEnd={handleScrollEnd}
        style={s.pager}
      >
        <ExchangeMarketPage
          width={SW}
          currency={currency}
          offers={offers}
          showSkeleton={!hasFetched && isLoading}
          error={error}
          refreshing={refreshing}
          isLoadingMore={isLoadingMore}
          onOpenFilter={() => setCurrencySheetOpen(true)}
          onClearCurrency={() => { setCurrency(null); resetFilters() }}
          onRetry={fetchOffers}
          onRefresh={handleRefresh}
          onLoadMore={loadMore}
        />
        <ExchangeMyOffersPage
          width={SW}
          myOffers={myOffers}
          currentUserId={user?.id ?? null}
          showSkeleton={isLoadingMine && myOffers.length === 0}
          refreshing={refreshing}
          onRefresh={handleRefresh}
          onPostOffer={() => router.push('/wallet/buy-sell?mode=offer' as Parameters<typeof router.push>[0])}
        />
      </ScrollView>

      <CurrencyFilterSheet
        visible={currencySheetOpen}
        onClose={() => setCurrencySheetOpen(false)}
        currency={currency}
        onSelect={handleCurrencySelect}
      />
    </ScreenContainer>
  )
}

const s = StyleSheet.create({
  tabRow: { flexDirection: 'row', borderBottomWidth: 1 },
  tab: { flex: 1, alignItems: 'center', paddingVertical: 14 },
  underline: { position: 'absolute', bottom: 0, left: 0, width: '50%', height: 2 },
  pager: { flex: 1 },
})
