import { useCallback, useRef, useState } from 'react'
import {
  View, FlatList, StyleSheet, RefreshControl,
  ScrollView, Animated, Pressable, useWindowDimensions,
} from 'react-native'
import { useFocusEffect } from 'expo-router'
import { useUnistyles } from 'react-native-unistyles'
import { spacing } from '@/theme/tokens'
import { ScreenContainer, Text, Spacer, EmptyState, Header } from '@/components/ui'
import { GigCardCompact } from '@/components/gig'
import { useAuthStore } from '@/stores/auth.store'
import { useUserGigsStore } from '@/stores/user-gigs.store'
import type { Gig } from '@tenda/shared'
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

  const underlineX = scrollX.interpolate({
    inputRange: [0, SW],
    outputRange: [0, SW / 2],
    extrapolate: 'clamp',
  })

  function fetchForPage(index: number) {
    if (!user?.id) return
    if (index === 0) fetchPostedGigs(user.id)
    else fetchWorkedGigs(user.id)
  }

  useFocusEffect(useCallback(() => {
    fetchForPage(pageIndex)
  }, [pageIndex, user?.id])) // eslint-disable-line react-hooks/exhaustive-deps

  async function handleRefresh() {
    setRefreshing(true)
    await (pageIndex === 0
      ? fetchPostedGigs(user?.id ?? '')
      : fetchWorkedGigs(user?.id ?? ''))
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
    { label: 'Posted',  data: postedGigs,  empty: { title: 'No gigs posted yet',        description: 'Post your first gig to get started' } },
    { label: 'Working', data: workedGigs,  empty: { title: 'Not working on any gigs',    description: 'Browse the feed to find and accept gigs' } },
  ] as const

  return (
    <ScreenContainer scroll={false} padding={false} edges={['left', 'right']}>
      <Header title="My Gigs" showBack />

      {/* ── Tab row + animated underline ── */}
      <View style={[s.tabRow, { borderBottomColor: theme.colors.borderFaint }]}>
        {tabs.map((tab, i) => (
          <Pressable key={tab.label} style={s.tab} onPress={() => scrollToPage(i)}>
            <Text
              weight="semibold"
              size={15}
              color={pageIndex === i ? theme.colors.primary : theme.colors.textSub}
            >
              {tab.label}
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
        {tabs.map((tab, i) => (
          <View key={tab.label} style={{ width: SW }}>
            <FlatList
              data={tab.data as Gig[]}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => <GigCardCompact gig={item} showStatus />}
              contentContainerStyle={s.list}
              showsVerticalScrollIndicator={false}
              refreshControl={
                <RefreshControl
                  refreshing={pageIndex === i && (refreshing || isLoading)}
                  onRefresh={handleRefresh}
                  tintColor={theme.colors.primary}
                />
              }
              ItemSeparatorComponent={() => <Spacer size={spacing.sm} />}
              ListFooterComponent={<Spacer size={spacing.xl} />}
              ListEmptyComponent={
                !isLoading ? (
                  <View style={s.empty}>
                    <EmptyState
                      icon={<ClipboardList size={40} color={theme.colors.textFaint} />}
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
  list: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
  },
  empty: {
    paddingTop: spacing['2xl'],
  },
})
