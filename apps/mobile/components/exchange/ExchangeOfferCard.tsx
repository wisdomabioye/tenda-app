import { View, Pressable, StyleSheet } from 'react-native'
import { useRouter } from 'expo-router'
import { useUnistyles } from 'react-native-unistyles'
import { Clock } from 'lucide-react-native'
import { spacing, radius, typography, shadows } from '@/theme/tokens'
import { Text } from '@/components/ui/Text'
import { Avatar } from '@/components/ui/Avatar'
import { ExchangeStatusBadge } from './ExchangeStatusBadge'
import { PaymentMethodBadge } from './PaymentMethodBadge'
import { formatFiat, formatSolDisplay, formatPaymentWindow } from '@/lib/currency'
import type { ExchangeOfferSummary } from '@tenda/shared'
import type { SupportedCurrency } from '@tenda/shared'

const LAMPORTS_PER_SOL = 1_000_000_000

interface Props {
  offer: ExchangeOfferSummary
  showStatus?: boolean
}

function deadlineLabel(deadline: string | null): string | null {
  if (!deadline) return null
  const ms = new Date(deadline).getTime() - Date.now()
  if (ms <= 0) return 'Expired'
  const h = Math.floor(ms / 3_600_000)
  if (h < 1) return '< 1h left'
  if (h < 24) return `${h}h left`
  return `${Math.floor(h / 24)}d left`
}

export function ExchangeOfferCard({ offer, showStatus = false }: Props) {
  const router = useRouter()
  const { theme } = useUnistyles()

  const sol = Number(offer.lamports_amount) / LAMPORTS_PER_SOL
  const fiatFormatted = formatFiat(offer.fiat_amount, offer.fiat_currency as SupportedCurrency)
  const rateFormatted = formatFiat(offer.rate, offer.fiat_currency as SupportedCurrency)
  const sellerName = `${offer.seller.first_name} ${offer.seller.last_name}`.trim()
  const deadlineTip = deadlineLabel(offer.accept_deadline as string | null)

  return (
    <Pressable
      onPress={() => router.push(`/exchange/${offer.id}` as any)}
      style={({ pressed }) => [
        s.card,
        {
          backgroundColor: theme.colors.surface,
          borderColor: theme.colors.borderFaint,
        },
        pressed && s.pressed,
      ]}
    >
      {/* Seller row */}
      <View style={s.sellerRow}>
        <Avatar
          src={offer.seller.avatar_url}
          name={sellerName}
          size="sm"
        />
        <View style={s.sellerInfo}>
          <Text weight="medium" size={typography.sizes.sm} numberOfLines={1}>
            {sellerName}
          </Text>
          {offer.seller.reputation_score != null && (
            <Text variant="caption" color={theme.colors.textFaint}>
              ★ {offer.seller.reputation_score.toFixed(1)}
            </Text>
          )}
        </View>
        {showStatus && <ExchangeStatusBadge status={offer.status} />}
      </View>

      {/* Amount row */}
      <View style={s.amountRow}>
        <Text weight="bold" size={typography.sizes.xl} color={theme.colors.money}>
          {fiatFormatted}
        </Text>
        <Text variant="caption" color={theme.colors.textSub} style={s.solLabel}>
          ≈ {formatSolDisplay(sol)}
        </Text>
      </View>

      {/* Rate + pay window */}
      <View style={s.metaRow}>
        <Text variant="caption" color={theme.colors.textSub}>
          Rate: {rateFormatted}/SOL
        </Text>
        <Text variant="caption" color={theme.colors.textSub}>
          Window: {formatPaymentWindow(offer.payment_window_seconds)}
        </Text>
      </View>

      {/* Footer: payment methods + deadline */}
      <View style={s.footer}>
        <View style={s.methods}>
          {offer.payment_methods.map((m) => (
            <PaymentMethodBadge key={m} method={m} />
          ))}
        </View>
        {deadlineTip && (
          <View style={s.deadline}>
            <Clock size={12} color={theme.colors.warning} />
            <Text size={11} color={theme.colors.warning}>{deadlineTip}</Text>
          </View>
        )}
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
  pressed: { opacity: 0.85 },
  sellerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  sellerInfo: {
    flex: 1,
  },
  amountRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: spacing.sm,
    marginBottom: 2,
  },
  solLabel: {
    marginBottom: 1,
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.sm,
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  methods: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    flex: 1,
  },
  deadline: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
})
