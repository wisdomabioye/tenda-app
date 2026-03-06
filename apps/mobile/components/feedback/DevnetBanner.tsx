import { View, Text } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { getEnv } from '@/lib/env'

export const IS_DEVNET = getEnv() !== 'production'

/**
 * Persistent top banner shown on non-production builds.
 * Returns null on mainnet — zero runtime cost and zero UI impact.
 *
 * Sits in normal flow above the Stack navigator. Uses paddingTop: top so
 * the text renders below the OS status bar icons. The root layout must wrap
 * the Stack in SafeAreaInsetsContext.Provider with top: 0 so the header
 * doesn't double-count the inset the banner already consumed.
 */
export function DevnetBanner() {
  const { top } = useSafeAreaInsets()
  if (!IS_DEVNET) return null
  return (
    <View style={{ paddingTop: top, paddingBottom: 4, backgroundColor: '#78350f', alignItems: 'center' }}>
      <Text style={{ color: '#fef3c7', fontSize: 10, fontWeight: '700', letterSpacing: 0.5 }}>
        DEVNET — not real money
      </Text>
    </View>
  )
}
