import { Platform } from 'react-native'
import { Buffer } from 'buffer'
import AsyncStorage from '@react-native-async-storage/async-storage'
import {
  Connection,
  PublicKey,
  VersionedTransaction,
  clusterApiUrl,
  type Transaction,
} from '@solana/web3.js'
import { authorizeSession, isMwaUserDeclined, withMwaRetry, SOLANA_CLUSTER } from './mwa-shared'
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

export interface ConnectAndSignResult {
  authToken: string
  /** base58 wallet address. */
  address: string
  /** base64 Ed25519 signature over the literal message string. */
  signature: string
  message: string
}

/**
 * Connect + sign a message in ONE MWA `transact` session (a single wallet
 * round-trip — connect() then signMessage() would open the wallet twice).
 * Used by the auth flows: the message can only be built once the wallet
 * reveals its address. Returns null when the user declines.
 *
 * Pass `existingAuthToken: null` deliberately to force a fresh authorize
 * (e.g. wallet linking, where the user must be able to pick a different
 * account in their wallet app).
 */
export async function connectAndSignMessage(
  buildMessage: (address: string) => string,
  existingAuthToken: string | null,
): Promise<ConnectAndSignResult | null> {
  try {
    const result = await withMwaRetry(async (wallet) => {
      const session = await authorizeSession(wallet, existingAuthToken)
      const address = base64ToAddress(session.addressBase64)
      const message = buildMessage(address)
      const [signed] = await wallet.signMessages({
        addresses: [session.addressBase64],
        payloads: [new TextEncoder().encode(message)],
      })
      return {
        authToken: session.authToken,
        address,
        signature: Buffer.from(signed).toString('base64'),
        message,
      }
    })
    await AsyncStorage.multiSet([
      [STORAGE_KEY_AUTH_TOKEN, result.authToken],
      [STORAGE_KEY_ADDRESS, result.address],
    ])
    return result
  } catch (err) {
    // withMwaRetry maps the protocol error to a plain Error — recheck the
    // cause chain is unnecessary: declines short-circuit before retries.
    if (err instanceof Error && err.message === 'Wallet request declined') return null
    if (isMwaUserDeclined(err)) return null
    throw err
  }
}

const connection = new Connection(clusterApiUrl(SOLANA_CLUSTER), 'confirmed')

/**
 * Sign a server-built transaction in the wallet, then broadcast from the
 * app's own RPC connection. Signing-only inside the wallet avoids the
 * wallet hanging on its internal RPC call (which prevents the signing
 * prompt from appearing). Returns the tx signature (the client-ping
 * tx_ref).
 */
export async function signAndSendTransaction(
  transaction: Transaction | VersionedTransaction,
  authToken: string,
  onNewAuthToken?: (token: string) => void,
): Promise<string> {
  const signed = await withMwaRetry(async (wallet) => {
    const session = await authorizeSession(wallet, authToken)
    if (session.authToken !== authToken) {
      onNewAuthToken?.(session.authToken)
    }
    const [signedTx] = await wallet.signTransactions({ transactions: [transaction] })
    return signedTx
  })

  const rawTx =
    signed instanceof VersionedTransaction
      ? signed.serialize()
      : (signed as Transaction).serialize()
  return connection.sendRawTransaction(rawTx, { preflightCommitment: 'confirmed' })
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
