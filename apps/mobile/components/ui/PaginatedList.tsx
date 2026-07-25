/**
 * The one FlatList wrapper every paginated surface renders through, driven by
 * a `usePaginatedList` controller. Centralising it keeps the end-reach
 * threshold, footer spinner, refresh control and "empty vs not-yet-fetched"
 * distinction identical across the feed, the order book, my gigs and my
 * trades — those had drifted into four slightly different hand-rolled lists.
 */
import { useMemo, type ReactElement } from 'react'
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  RefreshControl,
  View,
  type ListRenderItem,
  type ViewStyle,
} from 'react-native'
import { useUnistyles } from 'react-native-unistyles'
import { spacing } from '@/theme/tokens'
import { END_REACHED_THRESHOLD } from '@/lib/pagination'
import type { PaginatedListState } from '@/hooks/usePaginatedList'

interface PaginatedListProps<TItem> {
  list: PaginatedListState<TItem>
  keyOf: (item: TItem) => string
  renderItem: ListRenderItem<TItem>
  /** Shown while the FIRST page loads (nothing on screen yet). */
  skeleton?: ReactElement
  /** Shown when a settled load produced no rows. */
  empty?: ReactElement
  /** Shown instead of the list when the first page failed. */
  errorState?: ReactElement
  header?: ReactElement
  /**
   * Vertical gap between rows, in px. A number rather than an element on
   * purpose: an element prop is rebuilt by the caller on every render, so the
   * `() => separator` component handed to FlatList changes identity each time
   * and every separator remounts. Every call site wanted a plain gap anyway.
   */
  separatorHeight?: number
  contentContainerStyle?: ViewStyle
  style?: ViewStyle
  /** Pull-to-refresh. Omit to disable (e.g. a list inside a horizontal pager). */
  onRefresh?: () => void
  testID?: string
}

export function PaginatedList<TItem>({
  list,
  keyOf,
  renderItem,
  skeleton,
  empty,
  errorState,
  header,
  separatorHeight,
  contentContainerStyle,
  style,
  onRefresh,
  testID,
}: PaginatedListProps<TItem>) {
  const { theme } = useUnistyles()

  // Stable component identity per height, so separators aren't remounted on
  // every render of the list.
  const Separator = useMemo(
    () =>
      separatorHeight === undefined
        ? undefined
        : () => <View style={{ height: separatorHeight }} />,
    [separatorHeight],
  )

  // First-load skeleton only while there is genuinely nothing to show —
  // a refresh over existing rows keeps the rows visible.
  if (skeleton !== undefined && list.isLoading && list.items.length === 0) return skeleton
  // A first-page failure with no rows is an error screen, not an empty list;
  // once rows exist a later failure must not blank them out.
  if (errorState !== undefined && list.error !== null && list.items.length === 0) return errorState

  return (
    <FlatList
      testID={testID}
      style={style}
      data={list.items}
      keyExtractor={keyOf}
      renderItem={renderItem}
      contentContainerStyle={contentContainerStyle}
      showsVerticalScrollIndicator={false}
      ListHeaderComponent={header}
      ItemSeparatorComponent={Separator}
      onEndReached={list.loadMore}
      onEndReachedThreshold={END_REACHED_THRESHOLD}
      refreshControl={
        onRefresh === undefined ? undefined : (
          <RefreshControl
            refreshing={list.isRefreshing}
            onRefresh={onRefresh}
            tintColor={theme.colors.brand.primary}
          />
        )
      }
      ListFooterComponent={
        list.isLoadingMore ? (
          <ActivityIndicator style={s.footer} color={theme.colors.brand.primary} />
        ) : (
          <View style={s.footerSpacer} />
        )
      }
      // Never show "nothing here" before the first load settles — that reads
      // as an empty account rather than a pending fetch.
      ListEmptyComponent={list.hasFetched && !list.isLoading ? empty : undefined}
    />
  )
}

const s = StyleSheet.create({
  footer: { paddingVertical: spacing.md },
  footerSpacer: { height: spacing['2xl'] },
})
