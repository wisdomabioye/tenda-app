import { Buffer } from 'buffer'
import { 
  Connection, 
  PublicKey, 
  clusterApiUrl, 
  type Cluster,
  type Transaction, 
  type VersionedTransaction 
} from '@solana/web3.js'
import { transact, type Web3MobileWallet } from '@solana-mobile/mobile-wallet-adapter-protocol-web3js'
import { getEnv } from '@/lib/env'
import { apiConfig } from '@tenda/shared'

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
    return wallet.reauthorize({ 
      auth_token: authToken, 
      identity: APP_IDENTITY 
    })
  }
  return wallet.authorize({ 
    chain: `solana:${APP_IDENTITY.network}`, 
    identity: APP_IDENTITY 
  })
}

export async function authorizeWalletSession(mwaAuthToken?: string): Promise<WalletSession|null> {
    try {
      return await transact(async (wallet) => {
        // Use a timeout to prevent hanging
        const timeoutPromise = new Promise((_, reject) => {
            setTimeout(() => reject(new Error('Authorization timeout')), 30000)
        })

        const result = await Promise.race([
            authorizeSession(wallet, mwaAuthToken),
            timeoutPromise
        ]) as Awaited<ReturnType<typeof authorizeSession>>

        const account = result.accounts[0]
        if (!account) {
            throw new Error('No wallet account returned')
        }

        const publicKey = base64AddressToPublicKey(account.address)

        return {
            authToken: result.auth_token,
            walletAddress: publicKey.toBase58(),
            base64Address: account.address,
            publicKey,
        }
      })
    } catch (error: any) {
        // Handle specific MWA errors
        if (error.name === 'SolanaMobileWalletAdapterError') {
            if (error.message.includes('CancellationException')) {
                console.log('User cancelled wallet connection')
                return null
            }
            if (error.message.includes('AuthorizationDeclined')) {
                console.log('User declined authorization')
                return null
            }
        }
        console.error('Wallet authorization failed:', error)
        throw error
    }
}

export function buildAuthMessage(walletAddress: string): string {
  return [
    'Sign in to Tenda to verify your wallet.',
    `Wallet: ${walletAddress}`,
    `Chain: solana:${APP_IDENTITY.network}`,
    `URI: ${APP_IDENTITY.uri}`,
  ].join('\n')
}

export async function signMessageWithWallet(
  message: string,
  authToken: string,
  base64Address: string,
): Promise<string> {
  const messageBytes = new TextEncoder().encode(message)

  const signatureBytes = await transact(async (wallet) => {
    await authorizeSession(wallet, authToken)
    const signed = await wallet.signMessages({
      addresses: [base64Address],
      payloads: [messageBytes],
    })
    return signed[0]
  })

  return Buffer.from(signatureBytes).toString('base64')
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
): Promise<string> {
  return transact(async (wallet) => {
    await authorizeSession(wallet, authToken)
    const signatures = await wallet.signAndSendTransactions({ transactions: [transaction] })
    return signatures[0]
  })
}

export async function getBalance(publicKey: PublicKey): Promise<number> {
  return connection.getBalance(publicKey)
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