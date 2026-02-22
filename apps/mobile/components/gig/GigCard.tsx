import { View, Pressable, StyleSheet } from 'react-native'
import { useRouter } from 'expo-router'
import { useUnistyles } from 'react-native-unistyles'
import { MapPin, Clock } from 'lucide-react-native'
import { spacing, radius, shadows, typography } from '@/theme/tokens'
import { Text } from '@/components/ui/Text'
import { Avatar } from '@/components/ui/Avatar'
import { MoneyText } from '@/components/ui/MoneyText'
import { GigStatusBadge } from './GigStatusBadge'
import { getCategoryColor, CATEGORY_META } from '@/data/mock'
import { toPaymentDisplay } from '@/lib/currency'
import { useExchangeRateStore } from '@/stores/exchange-rate.store'
import { computeRelevantDeadline } from '@tenda/shared'
import { deadlineLabel } from '@/lib/gig-display'
import type { ColorScheme } from '@/theme/tokens'
import type { GigDetail } from '@tenda/shared'

interface GigCardProps {
  gig: GigDetail
  showStatus?: boolean
}

export function GigCard({ gig, showStatus = true }: GigCardProps) {
  const router = useRouter()
  const { theme } = useUnistyles()
  const solToNgn = useExchangeRateStore((s) => s.solToNgn)
  const categoryColorKey = getCategoryColor(gig.category) as keyof ColorScheme
  const categoryColor = theme.colors[categoryColorKey]
  const categoryLabel =
    CATEGORY_META.find((c) => c.key === gig.category)?.label ?? gig.category
  const price = toPaymentDisplay(gig.payment_lamports, solToNgn)
  const deadline = computeRelevantDeadline(gig)
  const label = deadlineLabel(deadline)

  const posterName = [gig.poster.first_name, gig.poster.last_name]
    .filter(Boolean)
    .join(' ') || 'Anonymous'

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
        <MoneyText naira={price.naira} sol={price.sol} size={typography.sizes.lg} />
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
        {label ? (
          <View style={s.metaItem}>
            <Clock size={14} color={theme.colors.textFaint} />
            <Text variant="caption" color={theme.colors.textSub}>
              {label}
            </Text>
          </View>
        ) : null}
      </View>

      <View style={[s.footer, { borderTopColor: theme.colors.borderFaint }]}>
        <View style={s.posterInfo}>
          <Avatar
            size="sm"
            name={posterName}
            src={gig.poster.avatar_url}
          />
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
