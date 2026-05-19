import { Platform } from 'react-native'
import { canOpenScheme } from './detect'
import type { WalletAdapter } from './types'

/**
 * Phantom on iOS via Phantom's encrypted universal-link protocol (X25519
 * keypair + nacl.box payloads, response parsed from URL fragments).
 *
 * Android-Solana is handled by the generic `solanaMwaAdapter` (MWA routes
 * to whatever Solana wallet the OS opens), so this adapter only reports
 * `isAvailable: true` on iOS.
 *
 * Implementation pending — operations throw a clear "pending universal-link
 * implementation" error so a tap surfaces the gap immediately at attempt
 * time rather than silently hanging.
 */
const pending = (op: string) => () => {
  throw new Error(`phantom (ios): ${op} pending universal-link implementation`)
}

export const phantomAdapter: WalletAdapter = {
  id: 'phantom',
  name: 'Phantom',
  iconSource: require('@/assets/wallets/phantom.png'),
  namespaces: ['solana'],
  isAvailable: async () => Platform.OS === 'ios',
  isInstalled: () => canOpenScheme('phantom'),
  connect: pending('connect'),
  signMessage: pending('signMessage'),
  disconnect: pending('disconnect'),
  getRestoredAccount: async () => null,
}
