import { View, StyleSheet } from 'react-native'
import { useUnistyles } from 'react-native-unistyles'
import { Text } from '@/components/ui'
import { spacing } from '@/theme/tokens'

/** Shared ScrollView content padding for both sell tabs. */
export const tabBodyStyle = { padding: spacing.md, gap: 12 } as const

function Row({ label, value, bold = false }: { label: string; value: string; bold?: boolean }) {
  const { theme } = useUnistyles()
  return (
    <View style={s.row}>
      <Text size={13} color={theme.colors.content.secondary}>{label}</Text>
      <Text size={13.5} weight={bold ? 'semibold' : 'regular'}>{value}</Text>
    </View>
  )
}

/** Rate / fee / receive breakdown with a live quote-expiry countdown. */
export function QuoteSummary({
  rate,
  fee,
  fiatAmount,
  currencySymbol,
  assetSymbol,
  expiresIn,
}: {
  rate: number
  fee: number
  fiatAmount: number
  currencySymbol: string
  assetSymbol: string
  expiresIn: number
}) {
  const { theme } = useUnistyles()
  return (
    <View style={[s.quoteCard, { backgroundColor: theme.colors.surface.card, borderColor: theme.colors.border.default }]}>
      <Row label="Rate" value={`${currencySymbol}${rate.toLocaleString()} / ${assetSymbol}`} />
      <Row label="Conversion fee" value={fee > 0 ? `${currencySymbol}${fee.toLocaleString()}` : 'Free'} />
      <Row label="You receive" value={`${currencySymbol}${fiatAmount.toLocaleString()}`} bold />
      <Text size={11.5} color={theme.colors.content.tertiary}>
        {expiresIn > 0
          ? `Quote valid for ${Math.floor(expiresIn / 60)}:${String(expiresIn % 60).padStart(2, '0')}`
          : 'Quote expired, amounts refresh on change'}
      </Text>
    </View>
  )
}

/** Soft "this route isn't available yet" panel (provider not live, #61). */
export function UnavailableNotice({ copy }: { copy: string }) {
  const { theme } = useUnistyles()
  return (
    <View style={[s.unavailable, { backgroundColor: theme.colors.surface.inset }]}>
      <Text size={13} color={theme.colors.content.secondary} align="center" style={s.unavailableText}>
        {copy}
      </Text>
    </View>
  )
}

const s = StyleSheet.create({
  quoteCard: { borderWidth: 1, borderRadius: 14, padding: 14, gap: 8 },
  row: { flexDirection: 'row', justifyContent: 'space-between' },
  unavailable: { borderRadius: 12, padding: 14 },
  unavailableText: { lineHeight: 18 },
})
