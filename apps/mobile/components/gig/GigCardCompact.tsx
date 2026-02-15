import { View, Pressable, StyleSheet } from 'react-native'
import { useRouter } from 'expo-router'
import { useUnistyles } from 'react-native-unistyles'
import { MapPin, Clock } from 'lucide-react-native'
import { spacing, radius, shadows, typography } from '@/theme/tokens'
import { Text } from '@/components/ui/Text'
import { MoneyText } from '@/components/ui/MoneyText'
import { Avatar } from '@/components/ui/Avatar'
import { GigStatusBadge } from './GigStatusBadge'
import { type MockGig, MOCK_USERS, getCategoryColor, CATEGORY_META } from '@/data/mock'
import { toPaymentDisplay } from '@/lib/currency'
import type { ColorScheme } from '@/theme/tokens'

interface GigCardCompactProps {
  gig: MockGig
  showStatus?: boolean
}

function getPosterName(posterId: string): string {
  const user = MOCK_USERS.find((u) => u.id === posterId)
  if (!user) return 'Unknown'
  return [user.first_name, user.last_name].filter(Boolean).join(' ') || 'Anonymous'
}

function formatDeadline(deadline: Date): string {
  const now = new Date()
  const diff = deadline.getTime() - now.getTime()
  const days = Math.ceil(diff / (1000 * 60 * 60 * 24))

  if (days < 0) return 'Expired'
  if (days === 0) return 'Today'
  if (days === 1) return 'Tomorrow'
  return `${days} days left`
}

export function GigCardCompact({ gig, showStatus = false }: GigCardCompactProps) {
  const router = useRouter()
  const { theme } = useUnistyles()
  const categoryColorKey = getCategoryColor(gig.category) as keyof ColorScheme
  const categoryColor = theme.colors[categoryColorKey]
  const categoryLabel =
    CATEGORY_META.find((c) => c.key === gig.category)?.label ?? gig.category
  const posterName = getPosterName(gig.poster_id)
  const price = toPaymentDisplay(gig.payment)

  return (
    <Pressable
      onPress={() => router.push(`/gig/${gig.id}`)}
      style={({ pressed }) => [
        s.card,
        {
          backgroundColor: theme.colors.surface,
          borderColor: theme.colors.borderFaint,
        },
        pressed && s.pressed,
      ]}
    >
      {/* Category */}
      <View style={s.categoryRow}>
        <View style={[s.categoryDot, { backgroundColor: categoryColor }]} />
        <Text variant="caption" color={theme.colors.textSub}>
          {categoryLabel}
        </Text>
        {showStatus && <GigStatusBadge status={gig.status} />}
      </View>

      {/* Title */}
      <Text variant="subheading" numberOfLines={2} style={s.title}>
        {gig.title}
      </Text>

      {/* Price */}
      <MoneyText naira={price.naira} sol={price.sol} size={typography.sizes['2xl']} />

      {/* Footer: location + deadline + poster */}
      <View style={s.footer}>
        <View style={s.metaItem}>
          <MapPin size={14} color={theme.colors.textFaint} />
          <Text variant="caption" color={theme.colors.textSub}>
            {gig.city}
          </Text>
        </View>
        <View style={s.metaItem}>
          <Clock size={14} color={theme.colors.textFaint} />
          <Text variant="caption" color={theme.colors.textSub}>
            {formatDeadline(gig.deadline)}
          </Text>
        </View>
        <View style={s.metaItem}>
          <Avatar size="sm" name={posterName} />
          <Text variant="caption" weight="medium">
            {posterName}
          </Text>
        </View>
      </View>
    </Pressable>
  )
}

const s = StyleSheet.create({
  card: {
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: spacing.md,
    ...shadows.sm,
  },
  categoryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  categoryDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  title: {
    marginTop: spacing.sm,
    marginBottom: spacing.xs,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  pressed: {
    opacity: 0.92,
    transform: [{ scale: 0.985 }],
  },
})
