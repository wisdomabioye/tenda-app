import { Image, StyleSheet } from 'react-native'
import type { WalletAdapter } from './adapters/types'

interface WalletIconProps {
  adapter: WalletAdapter
  size?: number
}

export function WalletIcon({ adapter, size = 36 }: WalletIconProps) {
  return (
    <Image
      source={adapter.iconSource}
      accessibilityIgnoresInvertColors
      style={[styles.root, { width: size, height: size, borderRadius: size / 2 }]}
    />
  )
}

const styles = StyleSheet.create({
  root: {
    resizeMode: 'contain',
  },
})
