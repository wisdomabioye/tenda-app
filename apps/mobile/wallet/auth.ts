/**
 * Wallet sign-in via the server-nonce flow (cutover §6, replaces the ±5min
 * timestamp window the server no longer accepts since #28).
 *
 * Flow: POST /v1/auth/nonce → buildAuthMessage (shared template — the
 * server parses the same format, a server unit test round-trips the two)
 * → wallet signs the literal string → POST /v1/auth/wallet.
 *
 * Transport-agnostic: the caller supplies `signMessage`, so this works with
 * today's MWA facade and the Stage-1 adapter façade after promotion.
 */

import { buildAuthMessage, solanaChainId, apiConfig, type AuthResponse } from '@tenda/shared'
import { api } from '@/api/client'
import { getEnv } from '@/lib/env'
import { APP_IDENTITY } from '@/wallet'
import { connectAndSignMessage, type ConnectAndSignResult } from '@/wallet/adapters/solana-mwa'

export interface SignInWithWalletArgs {
  /** Wallet address: base58 (Solana) or 0x-hex (EVM). */
  address: string
  /**
   * CAIP-2 chain id the wallet belongs to. Defaults to the Solana network
   * for the current build environment.
   */
  chain_id?: string
  /**
   * Sign the literal message string; returns base64 (Solana) or 0x-hex
   * (EVM). Provided by whichever wallet transport is active.
   */
  signMessage(message: string): Promise<string>
  is_seeker?: boolean
  country?: string | null
}

export async function signInWithWallet(args: SignInWithWalletArgs): Promise<AuthResponse> {
  const env = getEnv()
  // APP_IDENTITY maps build env → Solana cluster; solanaChainId maps the
  // cluster to the canonical CAIP id the server registry knows.
  const chain_id = args.chain_id ?? solanaChainId(APP_IDENTITY.network)
  const { nonce } = await api.auth.nonce()

  const message = buildAuthMessage({
    address: args.address,
    chain_id,
    uri: apiConfig[env].baseUrl,
    nonce,
  })
  const signature = await args.signMessage(message)

  return api.auth.wallet({
    chain_id,
    address: args.address,
    message,
    signature,
    ...(args.is_seeker !== undefined ? { is_seeker: args.is_seeker } : {}),
    ...(args.country !== undefined ? { country: args.country } : {}),
  })
}

// ---------- MWA-backed flows (Android Solana — the working transport) -----

export interface SolanaSignInResult {
  auth: AuthResponse
  session: Pick<ConnectAndSignResult, 'authToken' | 'address'>
}

function solanaAuthContext() {
  return {
    chain_id: solanaChainId(APP_IDENTITY.network),
    uri: apiConfig[getEnv()].baseUrl,
  }
}

/**
 * Full sign-in: prefetch nonce (5-min TTL — ample), one MWA session for
 * connect + sign (message built once the wallet reveals its address), then
 * the server exchange. Returns null when the user declines in the wallet.
 */
export async function solanaSignIn(opts: {
  mwaAuthToken?: string
  is_seeker?: boolean
  country?: string | null
}): Promise<SolanaSignInResult | null> {
  const { chain_id, uri } = solanaAuthContext()
  const { nonce } = await api.auth.nonce()

  const signed = await connectAndSignMessage(
    (address) => buildAuthMessage({ address, chain_id, uri, nonce }),
    opts.mwaAuthToken ?? null,
  )
  if (signed === null) return null

  const auth = await api.auth.wallet({
    chain_id,
    address: signed.address,
    message: signed.message,
    signature: signed.signature,
    ...(opts.is_seeker !== undefined ? { is_seeker: opts.is_seeker } : {}),
    ...(opts.country !== undefined ? { country: opts.country } : {}),
  })
  return { auth, session: { authToken: signed.authToken, address: signed.address } }
}

/**
 * Link an additional Solana wallet to the authenticated account
 * (POST /v1/auth/link-wallet). Same nonce + signature dance as sign-in;
 * the JWT proves the existing account. Returns the linked address, or
 * null when the user declines.
 *
 * No mwaAuthToken is passed on purpose — a cached MWA authorization would
 * silently re-link the wallet already on the account; a fresh authorize
 * lets the user pick a different account in their wallet app.
 */
export async function solanaLinkWallet(): Promise<{ address: string } | null> {
  const { chain_id, uri } = solanaAuthContext()
  const { nonce } = await api.auth.nonce()

  const signed = await connectAndSignMessage(
    (address) => buildAuthMessage({ address, chain_id, uri, nonce }),
    null,
  )
  if (signed === null) return null

  await api.auth.linkWallet({
    chain_id,
    address: signed.address,
    message: signed.message,
    signature: signed.signature,
  })
  return { address: signed.address }
}
