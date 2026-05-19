import { getEnv } from '@/lib/env'
import type { Namespace } from './types'

const env = getEnv()

export const metadata = {
  name: 'Tenda',
  description: 'Tenda multichain self-custodial wallet',
  url: 'https://tendahq.com',
  iconUrl: 'https://tendahq.com/icon.png',
  // Native deeplink wallets bounce back to via this scheme after approve/sign.
  redirectScheme: 'tenda',
}

/** Active chain per namespace. Production reads from gig context. */
export const SPIKE_CHAINS: Record<Namespace, string> = {
  eip155: env === 'production' ? 'eip155:8453' : 'eip155:84532', // Base / Base Sepolia
  solana: 'solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp', // mainnet-beta
}
