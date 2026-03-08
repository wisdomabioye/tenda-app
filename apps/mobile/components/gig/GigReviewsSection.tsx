import { View, StyleSheet } from 'react-native'
import { spacing } from '@/theme/tokens'
import { Text } from '@/components/ui/Text'
import { ReviewCard } from './ReviewCard'
import type { Review, GigDetail } from '@tenda/shared'

type GigUser = GigDetail['poster']

interface Props {
  reviews: Review[]
  posterId: string
  poster: GigUser
  worker: GigUser | null | undefined
  currentUserId: string
}

export function GigReviewsSection({ reviews, posterId, poster, worker, currentUserId }: Props) {
  if (reviews.length === 0) return null

  return (
    <>
      <Text variant="subheading">Reviews</Text>
      <View style={s.stack}>
        {reviews.map((review) => {
          const isPoster  = review.reviewer_id === posterId
          const reviewer  = isPoster ? poster : worker
          const roleLabel = isPoster ? 'Poster' : 'Worker'
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
