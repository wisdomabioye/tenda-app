import { View, StyleSheet } from 'react-native'
import { useUnistyles } from 'react-native-unistyles'
import { Star } from 'lucide-react-native'
import { Avatar } from '@/components/ui/Avatar'
import { Text } from '@/components/ui/Text'
import { Card } from '@/components/ui/Card'
import { spacing } from '@/theme/tokens'
import type { Review } from '@tenda/shared'

interface ReviewCardProps {
  review: Review
  reviewer: {
    first_name: string | null
    last_name: string | null
    avatar_url: string | null
  }
  label: string
}

export function ReviewCard({ review, reviewer, label }: ReviewCardProps) {
  const { theme } = useUnistyles()

  const name = [reviewer.first_name, reviewer.last_name].filter(Boolean).join(' ') || 'Anonymous'
  const date = review.created_at
    ? new Date(review.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
    : null

  return (
    <Card variant="outlined">
      <View style={s.header}>
        <Avatar size="sm" name={name} src={reviewer.avatar_url} />
        <View style={s.meta}>
          <Text variant="caption" weight="semibold" color={theme.colors.textSub}>
            {label}
          </Text>
          <Text variant="body" weight="semibold">{name}</Text>
        </View>
        <View style={s.stars}>
          {Array.from({ length: 5 }).map((_, i) => (
            <Star
              key={i}
              size={14}
              color={theme.colors.warning}
              fill={i < review.score ? theme.colors.warning : 'transparent'}
            />
          ))}
        </View>
      </View>

      {review.comment ? (
        <Text variant="body" color={theme.colors.textSub} style={s.comment}>
          {review.comment}
        </Text>
      ) : null}

      {date ? (
        <Text size={11} color={theme.colors.textFaint} style={s.date}>
          {date}
        </Text>
      ) : null}
    </Card>
  )
}

const s = StyleSheet.create({
  header:  { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  meta:    { flex: 1 },
  stars:   { flexDirection: 'row', gap: 2 },
  comment: { marginTop: spacing.sm },
  date:    { marginTop: spacing.xs },
})
