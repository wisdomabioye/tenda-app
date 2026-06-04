import type { ImageRequireSource } from 'react-native'
import type { Namespace, SignMessageResult, SpikeAccount } from '../types'

/**
 * Uniform surface every wallet integration implements. The picker, provider,
 * and any consumer code interact with wallets only through this interface —
 * the underlying transport (MetaMask SDK, Coinbase SDK, Solana MWA, Phantom
 * universal links) is an implementation detail of each adapter.
 */
export interface WalletAdapter {
  /** Stable identifier used by the picker and stored on `SpikeAccount.walletId`. */
  readonly id: string
  /** Display name in the picker. */
  readonly name: string
  /** Bundled wallet icon. `require('@/assets/wallets/<id>.png')` result. */
  readonly iconSource: ImageRequireSource
  /** Which CAIP-2 namespaces this adapter can talk to. */
  readonly namespaces: readonly Namespace[]

  /**
   * Whether this adapter is usable on the current device/platform. Picker
   * hides adapters that return `false` — e.g. Solflare on iOS (no SDK).
   */
  isAvailable(): Promise<boolean>

  /**
   * Whether the wallet app is present on the device. Picker shows a check
   * mark when `true`. Uses `Linking.canOpenURL` under the hood — relies on
   * the wallet's deeplink scheme being declared in `with-wallet-queries`.
   */
  isInstalled(): Promise<boolean>

  /** Open the wallet, request approval, and resolve with the connected account. */
  connect(): Promise<SpikeAccount>

  /** Request the wallet to sign `message` for `account`. */
  signMessage(account: SpikeAccount, message: string): Promise<SignMessageResult>

  /** End any persistent session this adapter holds. Safe to call when not connected. */
  disconnect(): Promise<void>

  /**
   * Best-effort restore on app launch. Returns the previously connected
   * account if the adapter still has a valid session, otherwise `null`.
   */
  getRestoredAccount(): Promise<SpikeAccount | null>
}
