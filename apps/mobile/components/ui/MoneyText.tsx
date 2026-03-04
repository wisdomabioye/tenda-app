import { View } from 'react-native'
import { useUnistyles } from 'react-native-unistyles'
import { Text } from './Text'
import { formatNaira, formatSolDisplay } from '@/lib/currency'

interface MoneyTextProps {
  /** Fiat value in naira (whole number, not kobo) */
  naira: number
  /** SOL amount (not lamports) */
  sol: number
  size?: number
}

export function MoneyText({ naira, sol, size }: MoneyTextProps) {
  const { theme } = useUnistyles()

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
      <Text weight="bold" color={theme.colors.money} size={size}>
        {formatNaira(naira)}
      </Text>
      <Text variant="caption" color={theme.colors.textSub}>{'\u2248'}</Text>
      <Text variant="caption" color={theme.colors.textSub}>
        {formatSolDisplay(sol)}
      </Text>
    </View>
  )
}
