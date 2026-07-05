import { useState } from 'react'
import { View, StyleSheet, Pressable } from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useUnistyles } from 'react-native-unistyles'
import { ScreenContainer, Text, Header } from '@/components/ui'
import { spacing } from '@/theme/tokens'
import { BuyTab } from '@/components/wallet/buy-sell/BuyTab'
import { SellTab } from '@/components/wallet/buy-sell/SellTab'

type Tab = 'buy' | 'sell'

/**
 * Buy/Sell page (stage-8 § Mobile), Naira-first; the traded asset is the
 * wallet's native asset pre-cutover (SOL; USDC arrives with the licensed
 * providers). Buy gracefully degrades to "not available yet" until a
 * provider with onramp capability is live (#61).
 */
export default function BuySellScreen() {
  const router = useRouter()
  const { theme } = useUnistyles()
  const { tab } = useLocalSearchParams<{ tab?: string }>()
  const [active, setActive] = useState<Tab>(tab === 'sell' ? 'sell' : 'buy')

  return (
    <ScreenContainer scroll={false} padding={false} edges={['left', 'right', 'bottom']}>
      <Header title="Buy / Sell" showBack onBackPress={() => router.back()} />

      <View style={s.tabRow}>
        {(['buy', 'sell'] as const).map((t) => (
          <Pressable
            key={t}
            onPress={() => setActive(t)}
            style={[
              s.tab,
              {
                backgroundColor: active === t ? theme.colors.brand.primary : theme.colors.surface.card,
                borderColor: active === t ? theme.colors.brand.primary : theme.colors.border.default,
              },
            ]}
            accessibilityRole="button"
            accessibilityLabel={t === 'buy' ? 'Buy tab' : 'Sell tab'}
          >
            <Text
              size={14}
              weight="semibold"
              color={active === t ? theme.colors.brand.onPrimary : theme.colors.content.primary}
            >
              {t === 'buy' ? 'Buy' : 'Sell'}
            </Text>
          </Pressable>
        ))}
      </View>

      {active === 'buy' ? <BuyTab /> : <SellTab />}
    </ScreenContainer>
  )
}

const s = StyleSheet.create({
  tabRow: { flexDirection: 'row', gap: 8, paddingHorizontal: spacing.md, paddingVertical: 10 },
  tab: { flex: 1, alignItems: 'center', paddingVertical: 10, borderRadius: 12, borderWidth: 1 },
})
