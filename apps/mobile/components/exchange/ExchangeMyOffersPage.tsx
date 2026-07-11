import { View, FlatList, StyleSheet, RefreshControl } from 'react-native'
import { useUnistyles } from 'react-native-unistyles'
import { spacing } from '@/theme/tokens'
import { EmptyState } from '@/components/ui'
import { MyOfferRow } from './MyOfferRow'
import { OfferListSkeleton } from './OfferListSkeleton'
import type { EscrowListRow } from '@tenda/shared'

/**
 * "My Trades" page — the current user's exchange escrows on BOTH sides: offers
 * they posted (selling) and offers they accepted (buying). Without the buying
 * side a matched buyer loses the trade the moment they leave its detail screen,
 * as the market tab only lists still-open offers.
 */
export function ExchangeMyOffersPage({
  width,
  myOffers,
  currentUserId,
  showSkeleton,
  refreshing,
  onRefresh,
  onPostOffer,
}: {
  width: number
  myOffers: EscrowListRow[]
  currentUserId: string | null
  showSkeleton: boolean
  refreshing: boolean
  onRefresh: () => void
  onPostOffer: () => void
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
          renderItem={({ item }) => (
            <MyOfferRow
              offer={item}
              side={item.creator_id === currentUserId ? 'selling' : 'buying'}
            />
          )}
          contentContainerStyle={s.list}
          ItemSeparatorComponent={() => <View style={{ height: spacing.sm }} />}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.brand.primary} />}
          ListEmptyComponent={
            <EmptyState
              title="No trades yet"
              description="Post a sell offer or accept one from the market to see it here"
              action={{ label: 'Post offer', onPress: onPostOffer }}
            />
          }
        />
      )}
    </View>
  )
}

const s = StyleSheet.create({
  list: { padding: spacing.md, paddingBottom: spacing['2xl'] },
})
