import { Buffer } from 'buffer'
import {
  Connection,
  PublicKey,
  VersionedTransaction,
  clusterApiUrl,
  type Cluster,
  type Transaction,
} from '@solana/web3.js'
import { transact, type Web3MobileWallet } from '@solana-mobile/mobile-wallet-adapter-protocol-web3js'
import { getEnv } from '@/lib/env'
import { apiConfig, solanaChainId } from '@tenda/shared'

const env = getEnv()
const ENV_CONFIG = apiConfig[env]
const APP_IDENTITY_ENV: Record<
  typeof env, {
    name: string, 
    uri: string, 
    icon: string,
    network: Cluster
  }> = {
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
  }
}

export const APP_IDENTITY = APP_IDENTITY_ENV[env]

const connection = new Connection(clusterApiUrl(APP_IDENTITY.network), 'confirmed')

export interface WalletSession {
  authToken: string
  walletAddress: string
  base64Address: string
  publicKey: PublicKey
}

function base64AddressToPublicKey(base64Address: string): PublicKey {
  const bytes = Buffer.from(base64Address, 'base64')
  return new PublicKey(bytes)
}

async function authorizeSession(wallet: Web3MobileWallet, authToken?: string) {
  if (authToken) {
    try {
      return await wallet.reauthorize({ auth_token: authToken, identity: APP_IDENTITY })
    } catch (err) {
      if (!isMwaStaleAuth(err)) throw err
      // Token expired/revoked — fall through to fresh authorize in the same session.
      // The WebSocket is still open after a JSON-RPC error; a new authorize request works fine.
      console.log('MWA auth token stale, re-authorizing in same session...')
    }
  }
  return wallet.authorize({
    chain: `solana:${APP_IDENTITY.network}`,
    identity: APP_IDENTITY,
  })
}

const MAX_RETRIES = 3
const RETRY_DELAY_MS = 500

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

function isMwaTransient(err: unknown): boolean {
  return (
    isMwaError(err) &&
    err.name === 'SolanaMobileWalletAdapterError' &&
    err.message.includes('CancellationException')
  )
}

function isMwaUserDeclined(err: unknown): boolean {
  return (
    isMwaError(err) &&
    err.name === 'SolanaMobileWalletAdapterError' &&
    err.message.includes('AuthorizationDeclined')
  )
}

function isMwaStaleAuth(err: unknown): boolean {
  return (
    isMwaError(err) &&
    err.name === 'SolanaMobileWalletAdapterProtocolError' &&
    err.message.includes('authorization request failed')
  )
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export interface ConnectAndSignResult {
  session: WalletSession
  signature: string
  message: string
}

export async function connectAndSignAuthMessage(
  mwaAuthToken?: string,
): Promise<ConnectAndSignResult | null> {
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      return await transact(async (wallet) => {
        const result = await authorizeSession(wallet, mwaAuthToken)

        const account = result.accounts[0]
        if (!account) {
          throw new Error('No wallet account returned')
        }

        const publicKey = base64AddressToPublicKey(account.address)
        const walletAddress = publicKey.toBase58()

        const message = buildAuthMessage(walletAddress)
        const messageBytes = new TextEncoder().encode(message)

        const signed = await wallet.signMessages({
          addresses: [account.address],
          payloads: [messageBytes],
        })

        const signature = Buffer.from(signed[0]).toString('base64')

        return {
          session: {
            authToken: result.auth_token,
            walletAddress,
            base64Address: account.address,
            publicKey,
          },
          signature,
          message,
        }
      })
    } catch (err: unknown) {
      if (isMwaUserDeclined(err)) {
        console.log('User declined authorization')
        return null
      }

      if (isMwaTransient(err) && attempt < MAX_RETRIES) {
        console.log(`MWA transient error, retrying (${attempt}/${MAX_RETRIES})...`)
        await delay(RETRY_DELAY_MS)
        continue
      }

      console.error('Wallet connect failed:', err)
      throw err
    }
  }

  return null
}

export function buildAuthMessage(walletAddress: string): string {
  const timestamp = new Date().toISOString()
  return [
    'Sign in to Tenda to verify your wallet.',
    `Wallet: ${walletAddress}`,
    `Chain: ${solanaChainId(APP_IDENTITY.network)}`,
    `URI: ${APP_IDENTITY.uri}`,
    `Timestamp: ${timestamp}`,
  ].join('\n')
}

export async function signTransactionWithWallet(
  transaction: Transaction | VersionedTransaction,
  authToken: string,
): Promise<Transaction | VersionedTransaction> {
  return transact(async (wallet) => {
    await authorizeSession(wallet, authToken)
    const signed = await wallet.signTransactions({ transactions: [transaction] })
    return signed[0]
  })
}

export async function signAndSendTransactionWithWallet(
  transaction: Transaction | VersionedTransaction,
  authToken: string,
  onNewAuthToken?: (token: string) => void,
): Promise<string> {
  // Sign only inside the wallet (no broadcast from wallet — avoids wallet hanging
  // on its internal RPC call, which prevents the signing prompt from appearing).
  const signed = await transact(async (wallet) => {
    const result = await authorizeSession(wallet, authToken)
    if (result.auth_token !== authToken) {
      onNewAuthToken?.(result.auth_token)
    }
    const [signedTx] = await wallet.signTransactions({ transactions: [transaction] })
    return signedTx
  })

  // Broadcast from the app's connection after the wallet session closes.
  const rawTx = signed instanceof VersionedTransaction
    ? signed.serialize()
    : (signed as Transaction).serialize()
  return connection.sendRawTransaction(rawTx, { preflightCommitment: 'confirmed' })
}

export async function getBalance(publicKey: PublicKey): Promise<number> {
  return connection.getBalance(publicKey)
}

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

export async function deauthorizeWallet(authToken?: string): Promise<void> {
  if (!authToken) return
  await transact(async (wallet) => {
    await wallet.deauthorize({ auth_token: authToken })
  })
}

export async function validateSession(authToken: string): Promise<boolean> {
  try {
    await transact(async (wallet) => {
      await wallet.reauthorize({ 
        auth_token: authToken, 
        identity: APP_IDENTITY 
      })
    })
    return true
  } catch {
    return false
  }
}