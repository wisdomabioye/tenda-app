import { View, Pressable, StyleSheet } from 'react-native'
import { useRouter } from 'expo-router'
import { useUnistyles } from 'react-native-unistyles'
import { MapPin, Clock } from 'lucide-react-native'
import { spacing, radius, shadows, typography } from '@/theme/tokens'
import { Text } from '@/components/ui/Text'
import { Avatar } from '@/components/ui/Avatar'
import { MoneyText } from '@/components/ui/MoneyText'
import { GigStatusBadge } from './GigStatusBadge'
import { type MockGig, type MockUser, MOCK_USERS, getCategoryColor, type GigStatus, CATEGORY_META } from '@/data/mock'
import type { ColorScheme } from '@/theme/tokens'

interface GigCardProps {
  gig: MockGig
  showStatus?: boolean
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

function getPosterName(posterId: string): string {
  const user = MOCK_USERS.find((u) => u.id === posterId)
  if (!user) return 'Unknown'
  return [user.first_name, user.last_name].filter(Boolean).join(' ') || 'Anonymous'
}

function getPoster(posterId: string): MockUser | undefined {
  return MOCK_USERS.find((u) => u.id === posterId)
}

const s = StyleSheet.create({
  card: {
    borderRadius: radius.lg,
    padding: spacing.md,
    ...shadows.sm,
  },
  accent: {
    position: 'absolute',
    left: 0,
    top: spacing.md,
    bottom: spacing.md,
    width: 4,
    borderRadius: 4,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
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
  titleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  titleWrap: {
    flex: 1,
  },
  meta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginTop: spacing.sm,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.md,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
  },
  posterInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  pressed: {
    opacity: 0.92,
    transform: [{ scale: 0.985 }],
  },
})

export function GigCard({ gig, showStatus = true }: GigCardProps) {
  const router = useRouter()
  const { theme } = useUnistyles()
  const poster = getPoster(gig.poster_id)
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
      <View style={[s.accent, { backgroundColor: categoryColor }]} />

      <View style={s.header}>
        <View style={s.categoryRow}>
          <View style={[s.categoryDot, { backgroundColor: categoryColor }]} />
          <Text variant="caption" color={theme.colors.textSub}>
            {categoryLabel}
          </Text>
        </View>
        {showStatus && <GigStatusBadge status={gig.status} />}
      </View>

      <View style={s.titleRow}>
        <View style={s.titleWrap}>
          <Text variant="subheading" numberOfLines={2}>
            {gig.title}
          </Text>
        </View>
        <MoneyText amount={gig.payment} size={typography.sizes.lg} />
      </View>

      <Text variant="caption" numberOfLines={2}>
        {gig.description}
      </Text>

      <View style={s.meta}>
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

      <View style={[s.footer, { borderTopColor: theme.colors.borderFaint }]}>
        <View style={s.posterInfo}>
          <Avatar
            size="sm"
            name={getPosterName(gig.poster_id)}
            src={poster?.avatar_url}
          />
          <Text variant="caption" weight="medium">
            {getPosterName(gig.poster_id)}
          </Text>
        </View>
      </View>
    </Pressable>
  )
}
