import type { Endpoint } from '../endpoint'
import type { AuthResponse, User } from '../../types'
import type { ChainNamespace } from '../../db/schema/chains'
import type { IdentityKind } from '../../db/schema/identity'

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

// ---------- Stage 1: phone OTP + wallet management (#38) -------------------

export type { ChainNamespace }

/** A wallet row linked to the authenticated user. */
export interface LinkedWallet {
  chain_ns: ChainNamespace
  address: string
  is_primary: boolean
  /** ISO-8601, or null while unverified. */
  verified_at: string | null
}

export interface SendPhoneOtpBody {
  /** E.164, e.g. +2348012345678. */
  phone_e164: string
}

/** 202 response — the code rides out-of-band via SMS. */
export interface SendPhoneOtpResponse {
  /** Seconds until the OTP expires. */
  expires_in: number
}

export interface VerifyPhoneOtpBody {
  phone_e164: string
  /** 6-digit code. */
  code: string
}

export interface VerifyPhoneOtpResponse {
  verified: true
}

/** Same shape as WalletNonceAuthBody minus the signup-only fields. */
export interface LinkWalletBody {
  chain_id: string
  address: string
  message: string
  signature: string
}

export interface LinkWalletResponse {
  ok: true
}

export interface WalletRefBody {
  chain_ns: ChainNamespace
  address: string
}

export interface UnlinkWalletResponse {
  unlinked: true
}

export interface SetPrimaryWalletResponse {
  primary: { chain_ns: ChainNamespace; address: string }
}

// ---------- Stage 9: unified passwordless auth ----------------------------

/** A login method on the unified /auth routes — identity kinds plus wallet. */
export type AuthMethodWire = IdentityKind | 'wallet'

/** POST /v1/auth/challenge — issue an OTP (phone/email). Wallet uses /nonce. */
export interface ChallengeBody {
  method: AuthMethodWire
  identifier: string
}

export interface ChallengeResponse {
  /** Seconds until an issued OTP expires (OTP channels only). */
  expires_in?: number
}

/**
 * POST /v1/auth/verify — fields are method-dependent: phone/email use
 * { identifier, code }; wallet uses { chain_id, address, message, signature };
 * google/apple use { id_token }. `is_seeker`/`country` bootstrap a new account.
 * A bearer token turns this into a LINK; anonymous logs in or creates.
 */
export interface VerifyBody {
  method: AuthMethodWire
  identifier?: string
  code?: string
  chain_id?: string
  address?: string
  message?: string
  signature?: string
  id_token?: string
  is_seeker?: boolean
  country?: string | null
}

export interface VerifyResponse {
  token: string
  user: User
  /** True when this verify created the account (vs logged into an existing one). */
  is_new: boolean
}

export interface AuthContract {
  nonce: Endpoint<'POST', undefined, undefined, undefined, AuthNonceResponse>
  challenge: Endpoint<'POST', undefined, ChallengeBody, undefined, ChallengeResponse>
  verify: Endpoint<'POST', undefined, VerifyBody, undefined, VerifyResponse>
  /** Server-nonce auth flow (#28) — the legacy timestamp flow died at the #34 cutover. */
  wallet: Endpoint<'POST', undefined, WalletNonceAuthBody, undefined, AuthResponse>
  me: Endpoint<'GET', undefined, undefined, undefined, User>
  sendPhoneOtp: Endpoint<'POST', undefined, SendPhoneOtpBody, undefined, SendPhoneOtpResponse>
  verifyPhoneOtp: Endpoint<'POST', undefined, VerifyPhoneOtpBody, undefined, VerifyPhoneOtpResponse>
  linkWallet: Endpoint<'POST', undefined, LinkWalletBody, undefined, LinkWalletResponse>
  unlinkWallet: Endpoint<'POST', undefined, WalletRefBody, undefined, UnlinkWalletResponse>
  setPrimaryWallet: Endpoint<'POST', undefined, WalletRefBody, undefined, SetPrimaryWalletResponse>
}
