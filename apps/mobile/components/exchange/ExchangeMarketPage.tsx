import { View, FlatList, ActivityIndicator, StyleSheet, RefreshControl, Pressable } from 'react-native'
import { useUnistyles } from 'react-native-unistyles'
import { SlidersHorizontal, X } from 'lucide-react-native'
import { spacing, radius } from '@/theme/tokens'
import { Text, Spacer, EmptyState, Button } from '@/components/ui'
import { ExchangeOfferCard } from './ExchangeOfferCard'
import { OfferListSkeleton } from './OfferListSkeleton'
import type { ExchangeSummary } from '@tenda/shared'

/** Market page (open offers) — currency filter pill + paginated offer list. */
export function ExchangeMarketPage({
  width,
  currency,
  offers,
  showSkeleton,
  error,
  refreshing,
  isLoadingMore,
  onOpenFilter,
  onClearCurrency,
  onRetry,
  onRefresh,
  onLoadMore,
}: {
  width: number
  currency: string | null
  offers: ExchangeSummary[]
  showSkeleton: boolean
  error: string | null
  refreshing: boolean
  isLoadingMore: boolean
  onOpenFilter: () => void
  onClearCurrency: () => void
  onRetry: () => void
  onRefresh: () => void
  onLoadMore: () => void
}) {
  const { theme } = useUnistyles()
  return (
    <View style={{ width }}>
      <View style={[s.filterRow, { borderBottomColor: theme.colors.border.subtle }]}>
        <Pressable style={[s.filterBtn, { backgroundColor: theme.colors.surface.backgroundAlt }]} onPress={onOpenFilter}>
          <SlidersHorizontal size={13} color={theme.colors.content.secondary} />
          <Text variant="caption" weight="medium" color={theme.colors.content.secondary}>
            {currency ?? 'All currencies'}
          </Text>
        </Pressable>
        {currency && (
          <Pressable hitSlop={8} onPress={onClearCurrency}>
            <X size={16} color={theme.colors.content.secondary} />
          </Pressable>
        )}
      </View>

      {showSkeleton ? (
        <OfferListSkeleton />
      ) : error ? (
        <View style={s.center}>
          <Text color={theme.colors.feedback.danger.text}>{error}</Text>
          <Spacer size={spacing.sm} />
          <Button variant="outline" size="sm" onPress={onRetry}>Retry</Button>
        </View>
      ) : (
        <FlatList
          data={offers}
          keyExtractor={(item) => item.escrow_id}
          renderItem={({ item }) => <ExchangeOfferCard offer={item} showStatus={false} />}
          contentContainerStyle={s.list}
          ItemSeparatorComponent={() => <View style={{ height: spacing.sm }} />}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.brand.primary} />}
          onEndReached={onLoadMore}
          onEndReachedThreshold={0.3}
          ListFooterComponent={isLoadingMore ? <ActivityIndicator style={s.footer} color={theme.colors.brand.primary} /> : null}
          ListEmptyComponent={
            <EmptyState
              title="No open offers"
              description={currency ? `No open ${currency} offers right now` : 'Check back soon for new offers'}
            />
          }
        />
      )}
    </View>
  )
}

const s = StyleSheet.create({
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
  list: { padding: spacing.md, paddingBottom: spacing['2xl'] },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
  footer: { paddingVertical: spacing.md },
})
