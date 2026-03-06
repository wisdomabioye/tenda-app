import { View, Text } from 'react-native'
import { getEnv } from '@/lib/env'

const IS_DEVNET = getEnv() !== 'production'

/**
 * Inline pill badge shown next to SOL balance labels on non-production builds.
 * Returns null on mainnet — no change to layout or rendering.
 */
export function DevnetBadge() {
  if (!IS_DEVNET) return null
  return (
    <View style={{ backgroundColor: '#78350f', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, marginLeft: 6 }}>
      <Text style={{ color: '#fef3c7', fontSize: 10, fontWeight: '700', letterSpacing: 0.5 }}>DEVNET</Text>
    </View>
  )
}
