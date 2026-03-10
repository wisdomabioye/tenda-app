import { View, Pressable, StyleSheet } from 'react-native'
import { useRouter } from 'expo-router'
import { useUnistyles } from 'react-native-unistyles'
import { MapPin, Clock, Globe, ArrowLeftRight } from 'lucide-react-native'
import { spacing, radius, typography } from '@/theme/tokens'
import { Text } from '@/components/ui/Text'
import { MoneyText } from '@/components/ui/MoneyText'
import { GigStatusBadge } from './GigStatusBadge'
import { getCategoryColor, CATEGORY_META } from '@/data/mock'
import { toPaymentDisplay } from '@/lib/currency'
import { useExchangeRateStore } from '@/stores/exchange-rate.store'
import { useSettingsStore } from '@/stores/settings.store'
import { computeRelevantDeadline, LOCATIONS, type CountryCode } from '@tenda/shared'
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
  const rates = useExchangeRateStore((s) => s.rates)
  const currency = useSettingsStore((s) => s.currency)
  const categoryColorKey = getCategoryColor(gig.category) as keyof ColorScheme
  const categoryColor = theme.colors[categoryColorKey]
  const categoryLabel =
    CATEGORY_META.find((c) => c.key === gig.category)?.label ?? gig.category
  const rate = rates?.[currency] ?? null
  const price = toPaymentDisplay(gig.payment_lamports, rate)
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
      <MoneyText fiat={price.fiat} ratesReady={rates !== null} currency={currency} sol={price.sol} size={typography.sizes.lg} />

      {/* Footer: location + deadline */}
      <View style={s.footer}>
        <View style={s.metaItem}>
          {gig.remote
            ? <Globe size={14} color={theme.colors.primary} />
            : <MapPin size={14} color={theme.colors.textFaint} />}
          <Text
            variant="caption"
            color={gig.remote ? theme.colors.primary : theme.colors.textSub}
          >
            {gig.remote
              ? `Remote · ${LOCATIONS[gig.country as CountryCode]?.flag ?? ''}`
              : gig.city}
          </Text>
        </View>
        {gig.cross_border && (
          <View style={s.metaItem}>
            <ArrowLeftRight size={14} color={theme.colors.warning} />
            <Text variant="caption" color={theme.colors.warning}>Cross-border</Text>
          </View>
        )}
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
