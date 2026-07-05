import { Pressable, StyleSheet } from 'react-native'
import { useUnistyles } from 'react-native-unistyles'
import { useRouter } from 'expo-router'
import { Text } from '@/components/ui/Text'
import { ASSET_META } from '@tenda/shared'
import { useWalletBalance } from '@/hooks/useWalletBalance'

/**
 * Stage 8 chained buy-then-post nudge, advisory only; funding happens at
 * publish. The wallet-balance hook is SOL-native, so the nudge only renders
 * when the budget is in native SOL and exceeds the current balance.
 */
export function AddFundsNudge({ asset, paymentRaw }: { asset: string; paymentRaw: number }) {
  const { theme } = useUnistyles()
  const router = useRouter()
  const { balanceLamports } = useWalletBalance()

  const show = ASSET_META[asset]?.is_stable !== true && balanceLamports !== null && paymentRaw > balanceLamports
  if (!show) return null

  return (
    <Pressable
      onPress={() => router.push('/wallet/buy-sell?tab=buy' as Parameters<typeof router.push>[0])}
      style={({ pressed }) => [
        s.addFunds,
        { backgroundColor: theme.colors.brand.primarySurface, borderColor: theme.colors.brand.primaryBorder },
        pressed && { opacity: 0.8 },
      ]}
      accessibilityRole="button"
      accessibilityLabel="Add funds"
    >
      <Text style={[s.addFundsText, { color: theme.colors.brand.primary }]}>
        Your balance won&apos;t cover this amount, add funds. Your draft stays right here.
      </Text>
    </Pressable>
  )
}

const s = StyleSheet.create({
  addFunds: {
    marginHorizontal: 20,
    marginTop: 10,
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  addFundsText: { fontSize: 12.5, lineHeight: 17 },
})
