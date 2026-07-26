import { useRef, useState } from 'react'
import { View, StyleSheet, ScrollView, Animated, useWindowDimensions } from 'react-native'
import { useUnistyles } from 'react-native-unistyles'
import { ClipboardList } from 'lucide-react-native'
import type { NativeSyntheticEvent, NativeScrollEvent } from 'react-native'
import type { GigSummary } from '@tenda/shared'
import { spacing } from '@/theme/tokens'
import { ScreenContainer, EmptyState, Header, PaginatedList } from '@/components/ui'
import { PagerTabBar } from '@/components/navigation'
import { ChainFilterChips } from '@/components/filters'
import { GigCardCompact, GigListSkeleton } from '@/components/gig'
import { useMyGigs } from '@/hooks/useMyGigs'
import type { PaginatedListState } from '@/hooks/usePaginatedList'

const TAB_INSET = 20

export default function MyGigsScreen() {
  const { theme }     = useUnistyles()
  const { width: SW } = useWindowDimensions()
  const { posted, working, chainId, setChainId } = useMyGigs()

  const [pageIndex, setPageIndex] = useState(0)

  const scrollRef = useRef<ScrollView>(null)
  const scrollX   = useRef(new Animated.Value(0)).current

  function scrollToPage(index: number) {
    setPageIndex(index)
    scrollRef.current?.scrollTo({ x: index * SW, animated: true })
  }

  function handleScrollEnd(e: NativeSyntheticEvent<NativeScrollEvent>) {
    const index = Math.round(e.nativeEvent.contentOffset.x / SW)
    if (index !== pageIndex) setPageIndex(index)
  }

  // Counts come from the server total for each list — both load on mount, so
  // neither chip reads 0 just because its tab hasn't been opened yet.
  const pages: {
    key: string
    label: string
    list: PaginatedListState<GigSummary>
    empty: { title: string; description: string }
  }[] = [
    {
      key: 'posted',
      label: 'Posted',
      list: posted,
      empty: { title: 'No gigs posted yet', description: 'Post your first gig to get started' },
    },
    {
      key: 'working',
      label: 'Working',
      list: working,
      empty: { title: 'Not working on any gigs', description: 'Browse the feed to find and accept gigs' },
    },
  ]

  return (
    <ScreenContainer scroll={false} padding={false} edges={['left', 'right']}>
      <Header title="My Gigs" showBack />

      <PagerTabBar
        // No chip until the list has actually loaded: `total` is 0 before the
        // first response, and rendering that reads as a confident "you have
        // none" — the very symptom this screen was fixed for.
        tabs={pages.map((p) => ({
          key: p.key,
          label: p.label,
          count: p.list.hasFetched ? p.list.total : undefined,
        }))}
        activeIndex={pageIndex}
        scrollX={scrollX}
        pageWidth={SW}
        onTabPress={scrollToPage}
        insetX={TAB_INSET}
      />

      {/*
        Outside the pager, deliberately. Nested inside it — as a list header on
        each page — this row is a horizontal ScrollView inside a horizontal
        pagingEnabled ScrollView, so the pager claimed every pan and swiping the
        chips switched tabs instead. Hoisting also collapses what were two
        instances of one control: `chainId` is shared by both tabs.
      */}
      <ChainFilterChips value={chainId} onChange={setChainId} gutterX={spacing.md} />

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
        {pages.map((page) => (
          <View key={page.key} style={{ width: SW }}>
            <PaginatedList<GigSummary>
              list={page.list}
              keyOf={(gig) => gig.escrow_id}
              renderItem={({ item }) => <GigCardCompact gig={item} showStatus />}
              contentContainerStyle={s.list}
              separatorHeight={spacing.sm}
              onRefresh={() => void page.list.refresh()}
              // This screen had NO loading state at all: the first load and
              // every chain-chip tap showed a bare chip row (or the previous
              // chain's rows) with nothing signalling a fetch.
              skeleton={<GigListSkeleton variant="priceLeading" count={3} />}
              empty={
                <View style={s.empty}>
                  <EmptyState
                    icon={<ClipboardList size={40} color={theme.colors.content.secondary} />}
                    title={page.empty.title}
                    description={page.empty.description}
                  />
                </View>
              }
            />
          </View>
        ))}
      </ScrollView>
    </ScreenContainer>
  )
}

const s = StyleSheet.create({
  pager: { flex: 1 },
  list: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
  },
  empty: {
    paddingTop: spacing['2xl'],
  },
})
