/**
 * Shared Solana Mobile Wallet Adapter helpers used by every Android-side
 * Solana adapter (Phantom, Solflare, future MWA-capable wallets).
 *
 * Mirrors the established usage in `wallet/index.ts` so the spike adapters
 * stay aligned with the legacy path until we eventually retire it.
 */
import {
  transact,
  type Web3MobileWallet,
} from '@solana-mobile/mobile-wallet-adapter-protocol-web3js'
import { getEnv } from '@/lib/env'
import { metadata } from '../config'

const env = getEnv()

export const SOLANA_CLUSTER: 'devnet' | 'mainnet-beta' =
  env === 'production' ? 'mainnet-beta' : 'devnet'

// MWA spec: `identity.icon` MUST be a relative URI. Don't reuse the absolute
// `metadata.iconUrl` (that one is for MM Connect / dApp registries).
const IDENTITY = {
  name: metadata.name,
  uri: metadata.url,
  icon: './favicon.ico',
}

interface MwaError {
  name: string
  message: string
}

function isMwaError(err: unknown): err is MwaError {
  return (
    typeof err === 'object' &&
    err !== null &&
    typeof (err as Record<string, unknown>).name === 'string' &&
    typeof (err as Record<string, unknown>).message === 'string'
  )
}

export function isMwaStaleAuth(err: unknown): boolean {
  return (
    isMwaError(err) &&
    err.name === 'SolanaMobileWalletAdapterProtocolError' &&
    err.message.includes('authorization request failed')
  )
}

export function isMwaTransient(err: unknown): boolean {
  return (
    isMwaError(err) &&
    err.name === 'SolanaMobileWalletAdapterError' &&
    err.message.includes('CancellationException')
  )
}

export function isMwaUserDeclined(err: unknown): boolean {
  if (!isMwaError(err)) return false
  if (
    err.name === 'SolanaMobileWalletAdapterError' &&
    err.message.includes('AuthorizationDeclined')
  ) {
    return true
  }
  // Protocol error code -1 = "approval denied" per the MWA spec.
  if (
    err.name === 'SolanaMobileWalletAdapterProtocolError' &&
    err.message.startsWith('-1/')
  ) {
    return true
  }
  return false
}

export function isMwaNoWallet(err: unknown): boolean {
  return (
    isMwaError(err) &&
    err.name === 'SolanaMobileWalletAdapterError' &&
    err.message.includes('no installed wallet')
  )
}

export interface AuthorizeResult {
  authToken: string
  addressBase64: string
}

/**
 * Reauthorize with an existing token if available; fall through to a fresh
 * authorize only when the token is specifically stale. Non-stale errors
 * bubble — they're real failures (network, declined) we want to surface.
 */
export async function authorizeSession(
  wallet: Web3MobileWallet,
  existingAuthToken: string | null,
): Promise<AuthorizeResult> {
  if (existingAuthToken) {
    try {
      const reauth = await wallet.reauthorize({
        auth_token: existingAuthToken,
        identity: IDENTITY,
      })
      const account = reauth.accounts[0]
      if (account) {
        return { authToken: reauth.auth_token, addressBase64: account.address }
      }
    } catch (err) {
      if (!isMwaStaleAuth(err)) throw err
      // Token revoked: WS is still open, fall through to a fresh authorize.
    }
  }
  const auth = await wallet.authorize({
    chain: `solana:${SOLANA_CLUSTER}`,
    identity: IDENTITY,
  })
  const account = auth.accounts[0]
  if (!account) throw new Error('Wallet returned no account')
  return { authToken: auth.auth_token, addressBase64: account.address }
}

const MAX_RETRIES = 3
const RETRY_DELAY_MS = 500

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Wraps `transact()` with retry on MWA's CancellationException — a known
 * transient when the user dismisses-and-reopens the wallet picker. Also
 * maps user-declined and no-wallet errors to clearer messages so adapter
 * callers don't have to know MWA's protocol error strings.
 *
 * `baseUri` targets a specific wallet's MWA endpoint (e.g. `'phantom:'` or
 * `'solflare:'`) so the OS routes directly to that wallet instead of showing
 * the generic Android chooser. Omit to fall back to MWA's standard discovery.
 */
export async function withMwaRetry<T>(
  op: (wallet: Web3MobileWallet) => Promise<T>,
  baseUri?: string,
): Promise<T> {
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      return await transact(op, baseUri ? { baseUri } : undefined)
    } catch (err) {
      if (isMwaUserDeclined(err)) {
        throw new Error('Wallet request declined')
      }
      if (isMwaTransient(err) && attempt < MAX_RETRIES) {
        await delay(RETRY_DELAY_MS)
        continue
      }
      if (isMwaNoWallet(err)) {
        throw new Error('No Solana wallet app installed')
      }
      throw err
    }
  }
  // Unreachable — the final attempt either returns or throws.
  throw new Error('MWA: exhausted retries unexpectedly')
}
