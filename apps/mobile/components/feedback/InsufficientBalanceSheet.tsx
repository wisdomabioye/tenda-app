import { View, StyleSheet } from 'react-native'
import { useRouter } from 'expo-router'
import { useUnistyles } from 'react-native-unistyles'
import { Wallet, ArrowDown } from 'lucide-react-native'
import { BottomSheet } from '@/components/ui/BottomSheet'
import { Button } from '@/components/ui/Button'
import { Text } from '@/components/ui/Text'
import { Spacer } from '@/components/ui/Spacer'
import { spacing, radius } from '@/theme/tokens'
import { formatSol } from '@/lib/currency'
import { useExchangeRateStore } from '@/stores/exchange-rate.store'
import { useSettingsStore } from '@/stores/settings.store'
import { CURRENCY_META } from '@tenda/shared'

interface Props {
  visible: boolean
  onClose: () => void
  balance: bigint
  required: bigint
}

export function InsufficientBalanceSheet({ visible, onClose, balance, required }: Props) {
  const { theme } = useUnistyles()
  const router = useRouter()
  const rates = useExchangeRateStore((s) => s.rates)
  const currency = useSettingsStore((s) => s.currency)
  const rate = rates?.[currency] ?? null
  const meta = CURRENCY_META[currency]

  const shortfall = required > balance ? required - balance : 0n
  const shortfallSol = Number(shortfall) / 1_000_000_000
  const shortfallFiat = rate != null
    ? (shortfallSol * rate).toLocaleString(meta.locale, { maximumFractionDigits: 0 })
    : null

  function handleGoToWallet() {
    onClose()
    router.push('/(tabs)/wallet')
  }

  return (
    <BottomSheet visible={visible} onClose={onClose} title="Insufficient balance">
      {/* Balance vs Required */}
      <View style={[s.card, { backgroundColor: theme.colors.surface, borderColor: theme.colors.borderFaint }]}>
        <View style={s.col}>
          <Text variant="caption" color={theme.colors.textFaint}>Your balance</Text>
          <Text weight="semibold" color={theme.colors.text}>{formatSol(Number(balance))}</Text>
        </View>
        <View style={[s.divider, { backgroundColor: theme.colors.borderFaint }]} />
        <View style={s.col}>
          <Text variant="caption" color={theme.colors.textFaint}>Required</Text>
          <Text weight="semibold" color={theme.colors.text}>{formatSol(Number(required))}</Text>
        </View>
      </View>

      {/* Shortfall arrow */}
      <View style={s.arrowRow}>
        <View style={[s.arrowLine, { backgroundColor: theme.colors.borderFaint }]} />
        <View style={[s.arrowIcon, { backgroundColor: theme.colors.surface, borderColor: theme.colors.borderFaint }]}>
          <ArrowDown size={14} color={theme.colors.textFaint} />
        </View>
        <View style={[s.arrowLine, { backgroundColor: theme.colors.borderFaint }]} />
      </View>

      {/* Shortfall amount */}
      <View style={[s.shortfallCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.borderFaint }]}>
        <Text variant="caption" color={theme.colors.textFaint}>You need</Text>
        <View style={s.shortfallAmount}>
          <Text variant="subheading" weight="semibold" color={theme.colors.danger}>{formatSol(Number(shortfall))}</Text>
          {shortfallFiat != null && (
            <Text variant="caption" color={theme.colors.textFaint}> ≈ {meta.symbol}{shortfallFiat}</Text>
          )}
        </View>
      </View>

      <Spacer size={spacing.lg} />

      <Button
        onPress={handleGoToWallet}
        icon={<Wallet size={16} color={theme.colors.onPrimary} />}
      >
        Top up Wallet
      </Button>
    </BottomSheet>
  )
}

const s = StyleSheet.create({
  card:          { flexDirection: 'row', padding: spacing.md, borderRadius: radius.md, borderWidth: StyleSheet.hairlineWidth, gap: spacing.md },
  col:           { flex: 1, gap: 4 },
  divider:       { width: StyleSheet.hairlineWidth, alignSelf: 'stretch' },
  arrowRow:      { flexDirection: 'row', alignItems: 'center', marginVertical: spacing.xs },
  arrowLine:     { flex: 1, height: StyleSheet.hairlineWidth },
  arrowIcon:     { width: 28, height: 28, borderRadius: radius.full, borderWidth: StyleSheet.hairlineWidth, alignItems: 'center', justifyContent: 'center', marginHorizontal: spacing.sm },
  shortfallCard: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: spacing.md, borderRadius: radius.md, borderWidth: StyleSheet.hairlineWidth },
  shortfallAmount: { flexDirection: 'row', alignItems: 'baseline', gap: 2 },
})
