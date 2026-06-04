import { View, StyleSheet } from 'react-native'
import { useUnistyles } from 'react-native-unistyles'
import { radius, typography } from '@/theme/tokens'
import { Text } from '@/components/ui/Text'
import { formatFiat, formatPaymentWindow } from '@/lib/currency'
import { ASSET_META } from '@tenda/shared'
import type { ExchangeDetail, SupportedCurrency } from '@tenda/shared'

/** Rate + payment-window terms card for the exchange detail screen. */
export function ExchangeTermsCard({ offer }: { offer: ExchangeDetail }) {
  const { theme } = useUnistyles()
  const rate = formatFiat(Number(offer.rate), offer.fiat_currency as SupportedCurrency)
  const symbol = ASSET_META[offer.asset]?.symbol ?? offer.asset

  return (
    <View
      style={[
        s.card,
        { backgroundColor: theme.colors.surface.card, borderColor: theme.colors.border.default },
      ]}
    >
      <View style={s.row}>
        <Text style={[s.label, { color: theme.colors.content.secondary }]}>Rate</Text>
        <Text style={[s.value, { color: theme.colors.content.primary }]}>
          {rate} / {symbol}
        </Text>
      </View>
      <View style={[s.divider, { backgroundColor: theme.colors.border.subtle }]} />
      <View style={s.row}>
        <Text style={[s.label, { color: theme.colors.content.secondary }]}>Payment window</Text>
        <Text style={[s.value, { color: theme.colors.content.primary }]}>
          {formatPaymentWindow(offer.payment_window_seconds)}
        </Text>
      </View>
    </View>
  )
}

const s = StyleSheet.create({
  card: {
    borderRadius: radius.lg,
    borderWidth: 1,
    overflow: 'hidden',
  },
  row: {
    height: 44,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  label: { fontSize: 13, lineHeight: 18 },
  value: {
    fontFamily: typography.fonts.mono,
    fontSize: 13.5,
    lineHeight: 18,
    fontWeight: '600',
  },
  divider: { height: 1 },
})
