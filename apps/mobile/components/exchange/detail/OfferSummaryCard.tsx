import { View, StyleSheet, Pressable } from 'react-native'
import { useUnistyles } from 'react-native-unistyles'
import { Copy } from 'lucide-react-native'
import * as Clipboard from 'expo-clipboard'
import { spacing, typography, radius } from '@/theme/tokens'
import { Text, Spacer, Card, Divider, showToast } from '@/components/ui'
import { ExchangeStatusBadge } from '@/components/exchange'
import { formatFiat, formatSolDisplay, formatPaymentWindow } from '@/lib/currency'
import type { ExchangeOfferDetail } from '@tenda/shared'
import type { SupportedCurrency } from '@tenda/shared'

const LAMPORTS_PER_SOL = 1_000_000_000

export function OfferSummaryCard({ offer }: { offer: ExchangeOfferDetail }) {
  const { theme } = useUnistyles()
  const sol      = Number(offer.lamports_amount) / LAMPORTS_PER_SOL
  const currency = offer.fiat_currency as SupportedCurrency

  async function copyAmount() {
    await Clipboard.setStringAsync(offer.fiat_amount.toString())
    showToast('success', 'Amount copied')
  }

  return (
    <Card variant="outlined" padding={spacing.md} style={s.card}>

      {/* Header row */}
      <View style={s.headerRow}>
        <Text variant="caption" color={theme.colors.textSub}>Amount to pay</Text>
        <ExchangeStatusBadge status={offer.status} />
      </View>

      <Spacer size={spacing.sm} />

      {/* Fiat amount — tappable to copy */}
      <Pressable style={s.amountRow} onPress={copyAmount}>
        <Text weight="bold" style={{ fontSize: 36, color: theme.colors.money, lineHeight: 42 }}>
          {formatFiat(offer.fiat_amount, currency)}
        </Text>
        <View style={[s.copyBadge, { backgroundColor: theme.colors.muted }]}>
          <Copy size={13} color={theme.colors.textFaint} />
        </View>
      </Pressable>

      <Spacer size={spacing.sm} />

      {/* SOL pill */}
      <View style={[s.solPill, { backgroundColor: theme.colors.primaryTint }]}>
        <Text size={typography.sizes.sm} weight="semibold" color={theme.colors.primary}>
          ◎ {formatSolDisplay(sol)}
        </Text>
        <Text variant="caption" color={theme.colors.primary} style={{ opacity: 0.7 }}>
          {' '}to receive
        </Text>
      </View>

      <Spacer size={spacing.md} />
      <Divider />
      <Spacer size={spacing.md} />

      {/* Meta row */}
      <View style={s.metaRow}>
        <MetaItem label="Pay window" value={formatPaymentWindow(offer.payment_window_seconds)} />
        <View style={[s.metaDivider, { backgroundColor: theme.colors.borderFaint }]} />
        <MetaItem label="Rate" value={`${formatFiat(offer.rate, currency)}/SOL`} />
        {offer.accept_deadline && (
          <>
            <View style={[s.metaDivider, { backgroundColor: theme.colors.borderFaint }]} />
            <MetaItem label="Deadline" value={new Date(offer.accept_deadline).toLocaleDateString()} />
          </>
        )}
      </View>

    </Card>
  )
}

function MetaItem({ label, value }: { label: string; value: string }) {
  const { theme } = useUnistyles()
  return (
    <View style={s.meta}>
      <Text variant="caption" color={theme.colors.textFaint}>{label}</Text>
      <Text size={typography.sizes.sm} weight="semibold">{value}</Text>
    </View>
  )
}

const s = StyleSheet.create({
  card:       { marginBottom: spacing.sm },
  headerRow:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  amountRow:  { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  copyBadge:  { padding: 5, borderRadius: radius.sm, marginTop: 2 },
  solPill:    { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', paddingVertical: 6, paddingHorizontal: spacing.sm, borderRadius: radius.md },
  metaRow:    { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  metaDivider:{ width: 1, height: 28 },
  meta:       { flex: 1, gap: 2 },
})
