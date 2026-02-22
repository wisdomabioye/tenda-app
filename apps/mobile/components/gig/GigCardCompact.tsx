import { View, Pressable, StyleSheet } from 'react-native'
import { useRouter } from 'expo-router'
import { useUnistyles } from 'react-native-unistyles'
import { MapPin, Clock } from 'lucide-react-native'
import { spacing, radius, typography } from '@/theme/tokens'
import { Text } from '@/components/ui/Text'
import { MoneyText } from '@/components/ui/MoneyText'
import { GigStatusBadge } from './GigStatusBadge'
import { getCategoryColor, CATEGORY_META } from '@/data/mock'
import { toPaymentDisplay } from '@/lib/currency'
import { useExchangeRateStore } from '@/stores/exchange-rate.store'
import { computeRelevantDeadline } from '@tenda/shared'
import { deadlineLabel } from '@/lib/gig-display'
import type { ColorScheme } from '@/theme/tokens'
import type { Gig } from '@tenda/shared'

interface GigCardCompactProps {
  gig: Gig
  showStatus?: boolean
}

export function GigCardCompact({ gig, showStatus = false }: GigCardCompactProps) {
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

      {/* Footer: location + deadline */}
      <View style={s.footer}>
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
    </Pressable>
  )
}

const s = StyleSheet.create({
  card: {
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: spacing.md,
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
