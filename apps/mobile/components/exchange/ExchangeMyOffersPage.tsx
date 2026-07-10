import { View, FlatList, StyleSheet, RefreshControl } from 'react-native'
import { useUnistyles } from 'react-native-unistyles'
import { spacing } from '@/theme/tokens'
import { EmptyState } from '@/components/ui'
import { MyOfferRow } from './MyOfferRow'
import { OfferListSkeleton } from './OfferListSkeleton'
import type { EscrowListRow } from '@tenda/shared'

/** "My Offers" page, the current user's created exchange offers. */
export function ExchangeMyOffersPage({
  width,
  myOffers,
  showSkeleton,
  refreshing,
  onRefresh,
}: {
  width: number
  myOffers: EscrowListRow[]
  showSkeleton: boolean
  refreshing: boolean
  onRefresh: () => void
}) {
  const { theme } = useUnistyles()
  return (
    <View style={{ width }}>
      {showSkeleton ? (
        <OfferListSkeleton />
      ) : (
        <FlatList
          data={myOffers}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <MyOfferRow offer={item} />}
          contentContainerStyle={s.list}
          ItemSeparatorComponent={() => <View style={{ height: spacing.sm }} />}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.brand.primary} />}
          ListEmptyComponent={
            <EmptyState title="No offers yet" description="Post a sell offer to see it here" />
          }
        />
      )}
    </View>
  )
}

const s = StyleSheet.create({
  list: { padding: spacing.md, paddingBottom: spacing['2xl'] },
})
