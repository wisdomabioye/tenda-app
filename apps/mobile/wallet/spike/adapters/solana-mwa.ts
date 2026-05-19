import { Platform } from 'react-native'
import { Buffer } from 'buffer'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { PublicKey } from '@solana/web3.js'
import { authorizeSession, withMwaRetry } from './mwa-shared'
import { SPIKE_CHAINS } from '../config'
import type { SignMessageResult, SpikeAccount } from '../types'
import type { WalletAdapter } from './types'

/**
 * Generic Android-Solana adapter via Solana Mobile Wallet Adapter (MWA).
 * The MWA spec doesn't expose a wallet-targeting API for local Android — the
 * OS routes the association intent to its default Solana wallet, or shows a
 * disambiguation chooser if none is set as default. Our picker therefore
 * presents a single "Solana Wallet" entry on Android; per-wallet branding
 * only makes sense where we have real per-wallet transports (i.e. iOS).
 *
 * On iOS this adapter reports `isAvailable: false` so the picker hides it.
 */

const STORAGE_KEY_AUTH_TOKEN = 'wallet.solana-mwa.authToken'
const STORAGE_KEY_ADDRESS = 'wallet.solana-mwa.address'

const ADAPTER_ID = 'solana-mwa'

function base64ToAddress(b64: string): string {
  return new PublicKey(Buffer.from(b64, 'base64')).toBase58()
}

function addressToBase64(address: string): string {
  return Buffer.from(new PublicKey(address).toBytes()).toString('base64')
}

async function connect(): Promise<SpikeAccount> {
  const stored = await AsyncStorage.getItem(STORAGE_KEY_AUTH_TOKEN)
  const result = await withMwaRetry((wallet) => authorizeSession(wallet, stored))
  const address = base64ToAddress(result.addressBase64)
  await AsyncStorage.multiSet([
    [STORAGE_KEY_AUTH_TOKEN, result.authToken],
    [STORAGE_KEY_ADDRESS, address],
  ])
  return {
    namespace: 'solana',
    chainId: SPIKE_CHAINS.solana,
    address,
    walletId: ADAPTER_ID,
  }
}

async function signMessage(
  account: SpikeAccount,
  message: string,
): Promise<SignMessageResult> {
  const stored = await AsyncStorage.getItem(STORAGE_KEY_AUTH_TOKEN)
  const messageBytes = new TextEncoder().encode(message)
  const signedBytes = await withMwaRetry(async (wallet) => {
    const session = await authorizeSession(wallet, stored)
    if (session.authToken !== stored) {
      await AsyncStorage.setItem(STORAGE_KEY_AUTH_TOKEN, session.authToken)
    }
    const [signed] = await wallet.signMessages({
      addresses: [addressToBase64(account.address)],
      payloads: [messageBytes],
    })
    return signed
  })
  return { signature: Buffer.from(signedBytes).toString('base64'), message }
}

async function disconnect(): Promise<void> {
  // Local-only. MWA `deauthorize()` requires a wallet round-trip via
  // `transact()`, which would open the wallet just to send a revoke message.
  // The stored auth token is harmless on the wallet side (auto-expires; user
  // can revoke from the wallet's connected-dapps UI if they want).
  await AsyncStorage.multiRemove([STORAGE_KEY_AUTH_TOKEN, STORAGE_KEY_ADDRESS])
}

async function getRestoredAccount(): Promise<SpikeAccount | null> {
  const [token, address] = await Promise.all([
    AsyncStorage.getItem(STORAGE_KEY_AUTH_TOKEN),
    AsyncStorage.getItem(STORAGE_KEY_ADDRESS),
  ])
  if (!token || !address) return null
  return {
    namespace: 'solana',
    chainId: SPIKE_CHAINS.solana,
    address,
    walletId: ADAPTER_ID,
  }
}

const unavailable = (op: string) => () => {
  throw new Error(`solana-mwa: ${op} unavailable on ${Platform.OS}`)
}

export const solanaMwaAdapter: WalletAdapter = {
  id: ADAPTER_ID,
  name: 'Solana Wallet',
  iconSource: require('@/assets/wallets/Solana.png'),
  namespaces: ['solana'],
  isAvailable: async () => Platform.OS === 'android',
  // The OS-level chooser is what surfaces "installed Solana wallets" on
  // Android — we can't probe individual wallets here without a target. So we
  // return true unconditionally and let MWA report "no installed wallet" at
  // connect time if there genuinely is none.
  isInstalled: async () => true,
  connect: Platform.OS === 'android' ? connect : unavailable('connect'),
  signMessage: Platform.OS === 'android' ? signMessage : unavailable('signMessage'),
  disconnect: Platform.OS === 'android' ? disconnect : unavailable('disconnect'),
  getRestoredAccount:
    Platform.OS === 'android' ? getRestoredAccount : async () => null,
}
