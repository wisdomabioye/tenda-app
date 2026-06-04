import type { Endpoint } from '../endpoint'
import type { WalletAuthBody, AuthResponse, User } from '../../types'

/** Response of POST /v1/auth/nonce (server-issued, single-use, 5-min TTL). */
export interface AuthNonceResponse {
  nonce: string
  /** Seconds until the nonce expires. */
  expires_in: number
  /** ISO-8601 issue timestamp — echo into the auth message's Issued At. */
  issued_at: string
}

/**
 * Body of POST /v1/auth/wallet — the nonce flow (replaced the ±5min
 * timestamp window in Stage 0 #28). `message` is the literal string built
 * by `buildAuthMessage` and signed by the wallet.
 */
export interface WalletNonceAuthBody {
  /** CAIP-2 chain id, e.g. 'solana:devnet'. */
  chain_id: string
  /** Wallet address: base58 (Solana) or 0x-hex (EVM). */
  address: string
  message: string
  /** base64 (Solana) or 0x-hex (EVM) signature over the literal message. */
  signature: string
  is_seeker?: boolean
  country?: string | null
}

export interface AuthContract {
  nonce: Endpoint<'POST', undefined, undefined, undefined, AuthNonceResponse>
  /**
   * Server expects `WalletNonceAuthBody` since #28. The legacy
   * `WalletAuthBody` (timestamp flow) remains in the union only so the
   * pre-cutover mobile code keeps compiling; the route rejects it.
   */
  wallet: Endpoint<'POST', undefined, WalletNonceAuthBody | WalletAuthBody, undefined, AuthResponse>
  me: Endpoint<'GET', undefined, undefined, undefined, User>
}
