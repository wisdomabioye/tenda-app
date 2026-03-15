import { View, StyleSheet } from 'react-native'
import { useUnistyles } from 'react-native-unistyles'
import { spacing, typography } from '@/theme/tokens'
import { Text, Spacer, Card, Divider } from '@/components/ui'
import { ExchangeStatusBadge } from '@/components/exchange'
import { formatFiat, formatSolDisplay, formatPaymentWindow } from '@/lib/currency'
import type { ExchangeOfferDetail } from '@tenda/shared'
import type { SupportedCurrency } from '@tenda/shared'

const LAMPORTS_PER_SOL = 1_000_000_000


export function OfferSummaryCard({ offer }: { offer: ExchangeOfferDetail }) {
  const { theme } = useUnistyles()
  const sol      = Number(offer.lamports_amount) / LAMPORTS_PER_SOL
  const currency = offer.fiat_currency as SupportedCurrency

  return (
    <Card variant="outlined" padding={spacing.md} style={s.card}>
      <ExchangeStatusBadge status={offer.status} />
      <Spacer size={spacing.sm} />
      <Text weight="bold" style={{ fontSize: 32, color: theme.colors.money }}>
        {formatFiat(offer.fiat_amount, currency)}
      </Text>
      <Text variant="caption" color={theme.colors.textSub}>
        ≈ {formatSolDisplay(sol)} · Rate {formatFiat(offer.rate, currency)}/SOL
      </Text>
      <Spacer size={spacing.sm} />
      <Divider />
      <Spacer size={spacing.sm} />
      <View style={s.row}>
        <MetaItem label="Pay window" value={formatPaymentWindow(offer.payment_window_seconds)} />
        {offer.accept_deadline && (
          <MetaItem label="Deadline" value={new Date(offer.accept_deadline).toLocaleDateString()} />
        )}
      </View>
    </Card>
  )
}

function MetaItem({ label, value }: { label: string; value: string }) {
  const { theme } = useUnistyles()
  return (
    <View style={s.meta}>
      <Text variant="caption" color={theme.colors.textSub}>{label}</Text>
      <Text size={typography.sizes.sm} weight="medium">{value}</Text>
    </View>
  )
}

const s = StyleSheet.create({
  card: { marginBottom: spacing.sm },
  row:  { flexDirection: 'row', gap: spacing.lg },
  meta: { gap: 2 },
})
