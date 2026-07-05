import type { Cluster } from '@solana/web3.js'
import { solanaChainId } from '@tenda/shared'
import { getEnv } from '@/lib/env'
import type { Namespace } from './types'

const env = getEnv()

/**
 * SINGLE source for the Solana cluster per build env. Everything that needs
 * the cluster derives from this: the RPC connection (wallet/index.ts), the
 * MWA `chain` param (adapters/mwa-shared.ts), the CAIP id below, and the
 * app-level network the gig/exchange/fiat screens read. Previously this env→
 * cluster decision was duplicated in three places (index.ts, mwa-shared.ts,
 * and, hardcoded wrong, here).
 */
export const SOLANA_NETWORK: Cluster = env === 'production' ? 'mainnet-beta' : 'devnet'

/**
 * Active CAIP-2 chain id per namespace, the value sent to the server (auth,
 * escrow create). Solana resolves through the shared `solanaChainId` so it
 * matches the server registry EXACTLY (`solana:devnet` / `solana:mainnet`, NOT
 * the genesis-hash form, which the registry never registered and which a dev
 * build must never send). EVM is Base / Base Sepolia per env.
 */
export const WALLET_CHAINS: Record<Namespace, string> = {
  solana: solanaChainId(SOLANA_NETWORK),
  eip155: env === 'production' ? 'eip155:8453' : 'eip155:84532', // Base / Base Sepolia
}

/**
 * App identity surfaced to wallet apps during connect / authorize / sign
 * (MetaMask Connect, Phantom universal links, and, via mwa-shared, MWA,
 * which substitutes a relative icon since it rejects absolute icon URIs).
 */
export const metadata = {
  name: 'Tenda',
  description: 'Tenda multichain self-custodial wallet',
  url: 'https://tendahq.com',
  iconUrl: 'https://tendahq.com/icon.png',
  // Native deeplink wallets bounce back to Tenda via this scheme after approve/sign.
  redirectScheme: 'tenda',
}
