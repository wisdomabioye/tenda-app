/**
 * Reown AppKit (WalletConnect v2) initialisation, the live EVM wallet path.
 * Relay-based, non-custodial: the user keeps their keys in their own wallet
 * app; we never touch them. WalletConnect is the battle-tested protocol path
 * the big-name EVM SDKs (MetaMask Connect) failed to deliver on-device, it
 * works across every WC v2 wallet (MetaMask, Trust, Rainbow, SafePal, Coinbase…).
 *
 * `@walletconnect/react-native-compat` MUST be imported before any AppKit/WC
 * code (it installs the crypto/Buffer/WebSocket globals the relay needs); the
 * AppKit package itself also imports it, but we front-load it here so this
 * module is safe to import in isolation.
 *
 * Requires a free Reown Cloud project id in `EXPO_PUBLIC_REOWN_PROJECT_ID`
 * (https://cloud.reown.com). Without it we skip init so the app still boots,
 * the WalletConnect adapter then reports `isAvailable() === false` and the
 * picker hides the EVM entry.
 */
import '@walletconnect/react-native-compat'
import { createAppKit } from '@reown/appkit-react-native'
import { EthersAdapter } from '@reown/appkit-ethers-react-native'
import { metadata } from '../config'
import { EVM_NETWORKS } from './networks'
import { reownStorage } from './storage'

const projectId = process.env.EXPO_PUBLIC_REOWN_PROJECT_ID ?? ''

/** Whether a Reown project id is configured (gates the WalletConnect EVM adapter). */
export const reownConfigured = projectId.length > 0

/**
 * The AppKit instance for `<AppKitProvider instance={appKit}>` (mounted by
 * `ReownProvider`). Null when no project id is set, so the app boots without a
 * Reown config and the picker simply omits the EVM entry.
 */
export const appKit = reownConfigured
  ? createAppKit({
      projectId,
      storage: reownStorage,
      networks: EVM_NETWORKS,
      adapters: [new EthersAdapter()],
      // Wallets only: hide the web2 (email + social) sign-in options — Tenda is
      // strictly non-custodial, so embedded-wallet auth must not be offered.
      features: { socials: false },
      metadata: {
        name: metadata.name,
        description: metadata.description,
        url: metadata.url,
        icons: [metadata.iconUrl],
        // Auto-return: the wallet bounces back to Tenda via `tenda://` after
        // approve/sign. That return lands on the `/` index route mid-verify, but
        // `index` holds a spinner while `walletAuthInProgress` (auth.store) is
        // set, so it no longer flashes welcome/get-started, then redirects home
        // once verify completes.
        redirect: { native: `${metadata.redirectScheme}://`, universal: metadata.url },
      },
    })
  : null
