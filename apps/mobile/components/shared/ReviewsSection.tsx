import { View, StyleSheet } from 'react-native'
import { spacing } from '@/theme/tokens'
import { Text } from '@/components/ui/Text'
import { ReviewCard } from './ReviewCard'
import type { Review } from '@tenda/shared'

interface ReviewParty {
  id: string
  first_name: string | null
  last_name: string | null
  avatar_url: string | null
}

interface Props {
  reviews: Review[]
  partyAId: string
  partyA: ReviewParty
  partyALabel: string
  partyB: ReviewParty | null | undefined
  partyBLabel: string
  currentUserId: string
}

export function ReviewsSection({ reviews, partyAId, partyA, partyALabel, partyB, partyBLabel, currentUserId }: Props) {
  if (reviews.length === 0) return null

  return (
    <>
      <Text variant="subheading">Reviews</Text>
      <View style={s.stack}>
        {reviews.map((review) => {
          const isPartyA  = review.reviewer_id === partyAId
          const reviewer  = isPartyA ? partyA : partyB
          const roleLabel = isPartyA ? partyALabel : partyBLabel
          const label     = review.reviewer_id === currentUserId
            ? `Your review (${roleLabel})`
            : `${roleLabel}'s review`
          if (!reviewer) return null
          return (
            <ReviewCard
              key={review.id}
              review={review}
              reviewer={reviewer}
              label={label}
            />
          )
        })}
      </View>
    </>
  )
}

const s = StyleSheet.create({
  stack: { gap: spacing.sm, marginTop: spacing.sm },
})
