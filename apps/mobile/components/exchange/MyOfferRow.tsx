import { View, Pressable, StyleSheet } from 'react-native'
import { useRouter } from 'expo-router'
import { useUnistyles } from 'react-native-unistyles'
import { ChevronRight } from 'lucide-react-native'
import { spacing } from '@/theme/tokens'
import { Text } from '@/components/ui/Text'
import { Spacer } from '@/components/ui/Spacer'
import { ExchangeStatusBadge } from './ExchangeStatusBadge'
import { formatAssetAmount } from '@tenda/shared'
import type { EscrowListRow } from '@tenda/shared'

/**
 * Own-offer row: EscrowListRow lacks the joined market fields, so it
 * renders the lean amount + status shape.
 */
export function MyOfferRow({ offer }: { offer: EscrowListRow }) {
  const router = useRouter()
  const { theme } = useUnistyles()
  return (
    <Pressable
      onPress={() => router.push(`/exchange/${offer.id}` as never)}
      style={({ pressed }) => [
        s.row,
        { borderBottomColor: theme.colors.border.subtle },
        pressed && { opacity: 0.96 },
      ]}
    >
      <View style={s.body}>
        <Text weight="semibold">
          {formatAssetAmount(offer.amount_raw, offer.asset)}
          {offer.fiat_currency ? ` → ${offer.fiat_currency}` : ''}
        </Text>
        <Spacer size={6} />
        <ExchangeStatusBadge status={offer.status} />
      </View>
      <ChevronRight size={20} color={theme.colors.content.tertiary} />
    </Pressable>
  )
}

const s = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: 14,
    paddingHorizontal: spacing.xs,
    borderBottomWidth: 1,
  },
  body: { flex: 1 },
})
