import { View, ScrollView, StyleSheet } from 'react-native'
import { useUnistyles } from 'react-native-unistyles'
import { spacing, typography } from '@/theme/tokens'
import { Text, Input, Spacer } from '@/components/ui'
import { Chip } from '@/components/ui/Chip'
import { SUPPORTED_CURRENCIES, CURRENCY_META } from '@tenda/shared'
import type { SupportedCurrency } from '@tenda/shared'

interface Props {
  solInput:     string
  fiatInput:    string
  currency:     SupportedCurrency
  rateInput:    string
  onSolChange:  (v: string) => void
  onFiatChange: (v: string) => void
  onCurrency:   (c: SupportedCurrency) => void
  onRateChange: (v: string) => void
}

export function OfferDetailsStep({
  solInput, fiatInput, currency, rateInput,
  onSolChange, onFiatChange, onCurrency, onRateChange,
}: Props) {
  const { theme } = useUnistyles()
  const symbol = CURRENCY_META[currency].symbol

  function handleSolChange(v: string) {
    onSolChange(v)
    const sol  = parseFloat(v)    || 0
    const fiat = parseFloat(fiatInput) || 0
    if (sol > 0 && fiat > 0) onRateChange(String(Math.round(fiat / sol)))
  }

  function handleFiatChange(v: string) {
    onFiatChange(v)
    const sol  = parseFloat(solInput) || 0
    const fiat = parseFloat(v) || 0
    if (sol > 0 && fiat > 0) onRateChange(String(Math.round(fiat / sol)))
  }

  return (
    <View style={s.wrap}>
      <Text variant="subheading">Offer details</Text>
      <Spacer size={spacing.md} />

      <Input
        label="SOL amount"
        placeholder="e.g. 2.5"
        keyboardType="decimal-pad"
        value={solInput}
        onChangeText={handleSolChange}
      />
      <Spacer size={spacing.sm} />

      <Text size={typography.sizes.sm} weight="medium" style={{ marginBottom: spacing.xs }}>
        Currency
      </Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View style={s.chips}>
          {SUPPORTED_CURRENCIES.map((cur) => (
            <Chip key={cur} label={cur} selected={currency === cur} onPress={() => onCurrency(cur)} />
          ))}
        </View>
      </ScrollView>
      <Spacer size={spacing.sm} />

      <Input
        label={`Fiat amount (${currency})`}
        placeholder={`e.g. ${symbol}85,000`}
        keyboardType="decimal-pad"
        value={fiatInput}
        onChangeText={handleFiatChange}
      />
      <Spacer size={spacing.sm} />

      <Input
        label={`Rate (${symbol}/SOL)`}
        placeholder="Auto-calculated"
        keyboardType="decimal-pad"
        value={rateInput}
        onChangeText={onRateChange}
        helper="Auto-filled from amounts above — edit to override"
      />
    </View>
  )
}

const s = StyleSheet.create({
  wrap:  { paddingHorizontal: spacing.md },
  chips: { flexDirection: 'row', gap: spacing.xs, paddingBottom: spacing.xs },
})
