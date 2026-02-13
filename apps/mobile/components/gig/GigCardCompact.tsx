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
import type { ColorScheme } from '@/theme/tokens'

interface GigCardCompactProps {
  gig: MockGig
  showStatus?: boolean
  variant?: 'inline' | 'pill'
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

const s = StyleSheet.create({
  card: {
    borderRadius: radius.lg,
    padding: spacing.md,
    ...shadows.sm,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
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
    marginTop: spacing.xs,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  pill: {
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: radius.full,
    backgroundColor: 'transparent',
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.sm,
  },
  poster: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  pressed: {
    opacity: 0.92,
    transform: [{ scale: 0.985 }],
  },
})

export function GigCardCompact({ gig, showStatus = false, variant = 'inline' }: GigCardCompactProps) {
  const router = useRouter()
  const { theme } = useUnistyles()
  const categoryColorKey = getCategoryColor(gig.category) as keyof ColorScheme
  const categoryColor = theme.colors[categoryColorKey]
  const categoryLabel =
    CATEGORY_META.find((c) => c.key === gig.category)?.label ?? gig.category

  return (
    <Pressable
      onPress={() => router.push(`/gig/${gig.id}`)}
      style={({ pressed }) => [
        s.card,
        { backgroundColor: theme.colors.surface },
        pressed && s.pressed,
      ]}
    >
      <View style={s.topRow}>
        <View style={s.categoryRow}>
          <View style={[s.categoryDot, { backgroundColor: categoryColor }]} />
          <Text variant="caption" color={theme.colors.textSub}>
            {categoryLabel}
          </Text>
          {showStatus && <GigStatusBadge status={gig.status} />}
        </View>
        <MoneyText amount={gig.payment} size={typography.sizes.lg} />
      </View>

      <Text variant="subheading" numberOfLines={2} style={s.title}>
        {gig.title}
      </Text>

      {variant === 'inline' ? (
        <View style={s.metaRow}>
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
        </View>
      ) : (
        <View style={s.metaRow}>
          <View style={[s.pill, { backgroundColor: theme.colors.muted }]}>
            <View style={s.metaItem}>
              <MapPin size={14} color={theme.colors.textFaint} />
              <Text variant="caption" color={theme.colors.textSub}>
                {gig.city}
              </Text>
            </View>
          </View>
          <View style={[s.pill, { backgroundColor: theme.colors.muted }]}>
            <View style={s.metaItem}>
              <Clock size={14} color={theme.colors.textFaint} />
              <Text variant="caption" color={theme.colors.textSub}>
                {formatDeadline(gig.deadline)}
              </Text>
            </View>
          </View>
        </View>
      )}

      <View style={s.footer}>
        <View style={s.poster}>
          <Avatar size="sm" name={getPosterName(gig.poster_id)} />
          <Text variant="caption" weight="medium">
            {getPosterName(gig.poster_id)}
          </Text>
        </View>
      </View>
    </Pressable>
  )
}