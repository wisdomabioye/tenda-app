/**
 * Wallet sign-in / linking via the server-nonce flow (cutover §6, replaces the
 * ±5min timestamp window the server dropped at #28).
 *
 * Flow: POST /v1/auth/nonce → `adapter.authenticate` builds + signs the shared
 * `buildAuthMessage` template → POST /v1/auth/wallet (sign-in) or
 * /v1/auth/link-wallet (link). Adapter-agnostic: each WalletAdapter owns its
 * own connect+sign round-trip; this module only orchestrates the nonce↔server
 * exchange and pins the canonical, server-registered chain id per namespace
 * (WALLET_CHAINS — single source, wallet/config.ts).
 */

import { buildAuthMessage, apiConfig, type AuthResponse } from '@tenda/shared'
import { api } from '@/api/client'
import { getEnv } from '@/lib/env'
import { WALLET_CHAINS } from '@/wallet/config'
import type { SpikeAccount } from '@/wallet/types'
import type { WalletAdapter } from '@/wallet/adapters/types'

/**
 * Nonce-bound auth message for a connected account, built with the canonical
 * server-registered chain id for that account's namespace (NOT the wallet's
 * arbitrary current chain — the signature is namespace-scoped, and the server
 * only verifies against registered chains).
 */
function authMessageFor(account: SpikeAccount, nonce: string): string {
  return buildAuthMessage({
    address: account.address,
    chain_id: WALLET_CHAINS[account.namespace],
    uri: apiConfig[getEnv()].baseUrl,
    nonce,
  })
}

export interface WalletSignInResult {
  auth: AuthResponse
  account: SpikeAccount
}

/**
 * Sign in with any wallet adapter: nonce → authenticate → POST /v1/auth/wallet.
 * Resolves to null when the user declines in the wallet; throws on transport or
 * server failure.
 */
export async function signInWithWallet(
  adapter: WalletAdapter,
  opts: { is_seeker?: boolean; country?: string | null } = {},
): Promise<WalletSignInResult | null> {
  const { nonce } = await api.auth.nonce()
  const result = await adapter.authenticate((account) => authMessageFor(account, nonce))
  if (result === null) return null

  const { account, signature, message } = result
  const auth = await api.auth.wallet({
    chain_id: WALLET_CHAINS[account.namespace],
    address: account.address,
    message,
    signature,
    ...(opts.is_seeker !== undefined ? { is_seeker: opts.is_seeker } : {}),
    ...(opts.country !== undefined ? { country: opts.country } : {}),
  })
  return { auth, account }
}

/**
 * Link an additional wallet to the authenticated account: nonce →
 * authenticate(forceFresh) → POST /v1/auth/link-wallet. `forceFresh` discards
 * any existing wallet session so the user can pick a DIFFERENT account than the
 * one already on their JWT. Returns the linked account, or null on decline.
 */
export async function linkWalletWith(adapter: WalletAdapter): Promise<SpikeAccount | null> {
  const { nonce } = await api.auth.nonce()
  const result = await adapter.authenticate((account) => authMessageFor(account, nonce), {
    forceFresh: true,
  })
  if (result === null) return null

  await api.auth.linkWallet({
    chain_id: WALLET_CHAINS[result.account.namespace],
    address: result.account.address,
    message: result.message,
    signature: result.signature,
  })
  return result.account
}
