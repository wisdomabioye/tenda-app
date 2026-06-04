import { useCallback, useRef, useState } from 'react'
import {
  View, FlatList, StyleSheet, RefreshControl,
  ScrollView, Animated, Pressable, useWindowDimensions,
} from 'react-native'
import { useFocusEffect } from 'expo-router'
import { useUnistyles } from 'react-native-unistyles'
import { spacing, typography } from '@/theme/tokens'
import { ScreenContainer, Text, Spacer, EmptyState, Header } from '@/components/ui'
import { GigCardCompact } from '@/components/gig'
import { useAuthStore } from '@/stores/auth.store'
import { useUserGigsStore } from '@/stores/user-gigs.store'
import type { GigSummary } from '@tenda/shared'
import { ClipboardList } from 'lucide-react-native'
import type { NativeSyntheticEvent, NativeScrollEvent } from 'react-native'

export default function MyGigsScreen() {
  const { theme }     = useUnistyles()
  const { width: SW } = useWindowDimensions()
  const user          = useAuthStore((s) => s.user)
  const { postedGigs, workedGigs, isLoading, fetchPostedGigs, fetchWorkedGigs } = useUserGigsStore()

  const [pageIndex, setPageIndex] = useState(0)
  const [refreshing, setRefreshing] = useState(false)

  const scrollRef = useRef<ScrollView>(null)
  const scrollX   = useRef(new Animated.Value(0)).current

  const TAB_WIDTH = (SW - 40) / 2

  const underlineX = scrollX.interpolate({
    inputRange: [0, SW],
    outputRange: [0, TAB_WIDTH],
    extrapolate: 'clamp',
  })

  function fetchForPage(index: number) {
    if (!user?.id) return
    if (index === 0) fetchPostedGigs()
    else fetchWorkedGigs()
  }

  useFocusEffect(useCallback(() => {
    fetchForPage(pageIndex)
  }, [pageIndex, user?.id])) // eslint-disable-line react-hooks/exhaustive-deps

  async function handleRefresh() {
    setRefreshing(true)
    await (pageIndex === 0 ? fetchPostedGigs() : fetchWorkedGigs())
    setRefreshing(false)
  }

  function scrollToPage(index: number) {
    setPageIndex(index)
    scrollRef.current?.scrollTo({ x: index * SW, animated: true })
    fetchForPage(index)
  }

  function handleScrollEnd(e: NativeSyntheticEvent<NativeScrollEvent>) {
    const index = Math.round(e.nativeEvent.contentOffset.x / SW)
    if (index === pageIndex) return
    setPageIndex(index)
    fetchForPage(index)
  }

  const tabs = [
    { label: 'Posted',  data: postedGigs, showStatus: true, empty: { title: 'No gigs posted yet',        description: 'Post your first gig to get started' } },
    { label: 'Working', data: workedGigs, showStatus: true, empty: { title: 'Not working on any gigs',    description: 'Browse the feed to find and accept gigs' } },
  ] as const

  return (
    <ScreenContainer scroll={false} padding={false} edges={['left', 'right']}>
      <Header title="My Gigs" showBack />

      {/* ── Pager: labels + count chips, animated underline ── */}
      <View style={[s.tabRow, { borderBottomColor: theme.colors.border.subtle }]}>
        {tabs.map((tab, i) => {
          const active = pageIndex === i
          return (
            <Pressable key={tab.label} style={s.tab} onPress={() => scrollToPage(i)}>
              <Text
                style={[
                  s.tabLabel,
                  { color: active ? theme.colors.content.primary : theme.colors.content.tertiary },
                ]}
              >
                {tab.label}
              </Text>
              <View
                style={[
                  s.count,
                  active
                    ? { backgroundColor: theme.colors.brand.primarySurface }
                    : { backgroundColor: theme.colors.surface.inset },
                ]}
              >
                <Text
                  style={[
                    s.countText,
                    { color: active ? theme.colors.brand.primary : theme.colors.content.tertiary },
                  ]}
                >
                  {tab.data.length}
                </Text>
              </View>
            </Pressable>
          )
        })}
        <Animated.View
          style={[
            s.underline,
            {
              width: TAB_WIDTH,
              backgroundColor: theme.colors.brand.primary,
              transform: [{ translateX: underlineX }],
            },
          ]}
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
        {tabs.map((tab, i) => (
          <View key={tab.label} style={{ width: SW }}>
            <FlatList
              data={tab.data}
              keyExtractor={(item) => item.escrow_id}
              renderItem={({ item }) => <GigCardCompact gig={item} showStatus={tab.showStatus} />}
              contentContainerStyle={s.list}
              showsVerticalScrollIndicator={false}
              refreshControl={
                <RefreshControl
                  refreshing={pageIndex === i && (refreshing || isLoading)}
                  onRefresh={handleRefresh}
                  tintColor={theme.colors.brand.primary}
                />
              }
              ItemSeparatorComponent={() => <Spacer size={spacing.sm} />}
              ListFooterComponent={<Spacer size={spacing.xl} />}
              ListEmptyComponent={
                !isLoading ? (
                  <View style={s.empty}>
                    <EmptyState
                      icon={<ClipboardList size={40} color={theme.colors.content.secondary} />}
                      title={tab.empty.title}
                      description={tab.empty.description}
                    />
                  </View>
                ) : null
              }
            />
          </View>
        ))}
      </ScrollView>
    </ScreenContainer>
  )
}

const s = StyleSheet.create({
  tabRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    paddingHorizontal: 20,
    height: 48,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  tabLabel: {
    fontSize: 14.5,
    fontWeight: '600',
    letterSpacing: -0.145,
  },
  count: {
    minWidth: 20,
    height: 20,
    paddingHorizontal: 6,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  countText: {
    fontFamily: typography.fonts.mono,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.11,
  },
  underline: {
    position: 'absolute',
    bottom: -1,
    left: 20,
    height: 3,
    borderTopLeftRadius: 2,
    borderTopRightRadius: 2,
  },
  pager: { flex: 1 },
  list: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
  },
  empty: {
    paddingTop: spacing['2xl'],
  },
})
