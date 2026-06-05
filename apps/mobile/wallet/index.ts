/**
 * Chain-agnostic wallet utilities (post-#34). Wallet CONNECTIONS live in
 * the promoted adapter stack (provider.tsx + adapters/*); unsigned-tx
 * signing + client-ping live in dispatch.ts. This module keeps only the
 * Solana RPC helpers and the shared error type that screens consume.
 *
 * The legacy MWA + idl/legacy escrow flow died at the cutover — escrow
 * transactions are built server-side (/v1/escrows) and signed via
 * dispatch.signSendAndReport.
 */
import { Connection, PublicKey, clusterApiUrl, type Cluster } from '@solana/web3.js'
import { getEnv } from '@/lib/env'
import { apiConfig } from '@tenda/shared'

const env = getEnv()
const ENV_CONFIG = apiConfig[env]

const APP_IDENTITY_ENV: Record<
  typeof env,
  {
    name: string
    uri: string
    icon: string
    network: Cluster
  }
> = {
  development: {
    name: 'Tenda Dev',
    uri: ENV_CONFIG.baseUrl,
    network: 'devnet',
    icon: './favicon.ico',
  },
  staging: {
    name: 'Tenda Staging',
    uri: ENV_CONFIG.baseUrl,
    network: 'devnet',
    icon: './favicon.ico',
  },
  production: {
    name: 'Tenda',
    uri: ENV_CONFIG.baseUrl,
    network: 'mainnet-beta',
    icon: './favicon.ico',
  },
}

export const APP_IDENTITY = APP_IDENTITY_ENV[env]

const connection = new Connection(clusterApiUrl(APP_IDENTITY.network), 'confirmed')

export type WalletErrorCode = 'no_wallet' | 'declined' | 'network' | 'unknown'

export class WalletError extends Error {
  constructor(
    public readonly code: WalletErrorCode,
    message: string,
    public readonly cause?: unknown,
  ) {
    super(message)
    this.name = 'WalletError'
  }
}

export async function getBalance(publicKey: PublicKey): Promise<number> {
  return connection.getBalance(publicKey)
}

export { getEvmTransactionStatus } from '@/wallet/adapters/metamask'

export type OnChainTxStatus = 'confirmed' | 'finalized' | 'failed' | 'not_found'

export async function getTransactionStatus(signature: string): Promise<OnChainTxStatus> {
  const result = await connection.getSignatureStatus(signature, { searchTransactionHistory: true })
  const value = result.value
  if (!value) return 'not_found'
  if (value.err) return 'failed'
  if (value.confirmationStatus === 'finalized') return 'finalized'
  if (value.confirmationStatus === 'confirmed') return 'confirmed'
  return 'not_found'
}
