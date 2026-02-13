import { useUnistyles } from 'react-native-unistyles'
import { Text } from './Text'

interface MoneyTextProps {
  amount: number
  currency?: string
  size?: number
}

function formatAmount(amount: number): string {
  const value = amount / 100
  return value.toLocaleString('en-NG', {
    minimumFractionDigits: value % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  })
}

export function MoneyText({ amount, currency = '\u20A6', size }: MoneyTextProps) {
  const { theme } = useUnistyles()

  return (
    <Text weight="bold" color={theme.colors.money} size={size}>
      {currency}{formatAmount(amount)}
    </Text>
  )
}
