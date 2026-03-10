import { View } from 'react-native'
import { useUnistyles } from 'react-native-unistyles'
import { Text } from './Text'
import { formatFiat, formatSolDisplay } from '@/lib/currency'
import type { SupportedCurrency } from '@tenda/shared'

interface MoneyTextProps {
  /** Fiat value in the given currency (whole number) */
  fiat: number
  /** Whether rates are available — hides fiat display when false */
  ratesReady: boolean
  currency: SupportedCurrency
  /** SOL amount (not lamports) */
  sol: number
  size?: number
}

export function MoneyText({ fiat, ratesReady, currency, sol, size }: MoneyTextProps) {
  const { theme } = useUnistyles()

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
      <Text weight="bold" color={theme.colors.money} size={size}>
        {ratesReady ? formatFiat(fiat, currency) : '—'}
      </Text>
      <Text variant="caption" color={theme.colors.textSub}>{'\u2248'}</Text>
      <Text variant="caption" color={theme.colors.textSub}>
        {formatSolDisplay(sol)}
      </Text>
    </View>
  )
}
