import { View } from 'react-native'
import { useUnistyles } from 'react-native-unistyles'
import { Text } from './Text'

interface MoneyTextProps {
  /** Fiat value in naira (whole number, not kobo) */
  naira: number
  /** SOL amount */
  sol: number
  size?: number
}

function formatNaira(value: number): string {
  return value.toLocaleString('en-NG', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })
}

function formatSol(value: number): string {
  return value.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  })
}

export function MoneyText({ naira, sol, size }: MoneyTextProps) {
  const { theme } = useUnistyles()

  return (
    <View>
      <Text weight="bold" color={theme.colors.money} size={size}>
        {'\u20A6'}{formatNaira(naira)}
      </Text>
      <Text variant="caption" color={theme.colors.textSub}>
        {formatSol(sol)} SOL
      </Text>
    </View>
  )
}
