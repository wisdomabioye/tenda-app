import { View, StyleSheet } from 'react-native'
import { useUnistyles } from 'react-native-unistyles'
import { spacing, typography } from '@/theme/tokens'
import { Text, Spacer, Card } from '@/components/ui'
import { CURRENCY_META } from '@tenda/shared'
import type { SupportedCurrency } from '@tenda/shared'
import { formatPaymentWindow } from '@/lib/currency'
import type { PaymentMethodFormEntry } from './PaymentMethodsStep'

interface Props {
  solNum:        number
  fiatNum:       number
  currency:      SupportedCurrency
  rateNum:       number
  windowSeconds: number
  hasDeadline:   boolean
  deadlineInput: string
  methods:       PaymentMethodFormEntry[]
}

export function ReviewStep({
  solNum, fiatNum, currency, rateNum,
  windowSeconds, hasDeadline, deadlineInput, methods,
}: Props) {
  const { theme } = useUnistyles()
  const symbol = CURRENCY_META[currency].symbol

  return (
    <View style={s.wrap}>
      <Text variant="subheading">Review your offer</Text>
      <Spacer size={spacing.md} />

      <Card variant="outlined" padding={spacing.md}>
        <Row label="SOL amount"  value={`${solNum} SOL`} />
        <Row label="Fiat amount" value={`${symbol}${fiatNum.toLocaleString()} ${currency}`} />
        <Row label="Rate"        value={`${symbol}${rateNum.toLocaleString()}/SOL`} />
        <Row label="Pay window"  value={formatPaymentWindow(windowSeconds)} />
        <Row label="Deadline"    value={hasDeadline && deadlineInput ? deadlineInput : 'None'} />
      </Card>

      <Spacer size={spacing.md} />
      <Text weight="semibold" size={typography.sizes.sm}>Payment methods</Text>
      <Spacer size={spacing.xs} />

      {methods.map((m) => (
        <Card key={m._key} variant="outlined" padding={spacing.sm} style={s.method}>
          <Text weight="medium" size={typography.sizes.sm}>{m.method}</Text>
          <Text variant="caption" color={theme.colors.textSub}>
            {m.account_name} · {m.account_number}
            {m.bank_name ? ` · ${m.bank_name}` : ''}
          </Text>
        </Card>
      ))}

      <Spacer size={spacing.md} />
      <Text variant="caption" color={theme.colors.textSub}>
        Tapping "Post & Fund Escrow" will open your wallet to sign a transaction locking
        your SOL in escrow until a buyer accepts.
      </Text>
    </View>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  const { theme } = useUnistyles()
  return (
    <View style={s.row}>
      <Text size={typography.sizes.sm} color={theme.colors.textSub}>{label}</Text>
      <Text size={typography.sizes.sm} weight="medium">{value}</Text>
    </View>
  )
}

const s = StyleSheet.create({
  wrap:   { paddingHorizontal: spacing.md },
  row:    { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 },
  method: { marginBottom: spacing.xs },
})
