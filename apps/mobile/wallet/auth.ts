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
