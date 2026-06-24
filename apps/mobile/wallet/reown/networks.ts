/**
 * EVM networks for the Reown AppKit EVM path, as `AppKitNetwork` objects (the
 * native AppKit shape — same fields as the SDK's built-in solana/bitcoin
 * networks). AppKit also accepts `viem/chains`, but we define ours inline to
 * stay explicit about exactly the four EVM chains Tenda supports and avoid a
 * viem dependency just for chain metadata.
 */
import type { AppKitNetwork } from '@reown/appkit-react-native'

const ETH = { name: 'Ether', symbol: 'ETH', decimals: 18 } as const

export const mainnet: AppKitNetwork = {
  id: 1,
  name: 'Ethereum',
  nativeCurrency: ETH,
  rpcUrls: { default: { http: ['https://cloudflare-eth.com'] } },
  blockExplorers: { default: { name: 'Etherscan', url: 'https://etherscan.io' } },
  chainNamespace: 'eip155',
  caipNetworkId: 'eip155:1',
  testnet: false,
}

export const base: AppKitNetwork = {
  id: 8453,
  name: 'Base',
  nativeCurrency: ETH,
  rpcUrls: { default: { http: ['https://mainnet.base.org'] } },
  blockExplorers: { default: { name: 'BaseScan', url: 'https://basescan.org' } },
  chainNamespace: 'eip155',
  caipNetworkId: 'eip155:8453',
  testnet: false,
}

export const baseSepolia: AppKitNetwork = {
  id: 84532,
  name: 'Base Sepolia',
  nativeCurrency: ETH,
  rpcUrls: { default: { http: ['https://sepolia.base.org'] } },
  blockExplorers: { default: { name: 'BaseScan', url: 'https://sepolia.basescan.org' } },
  chainNamespace: 'eip155',
  caipNetworkId: 'eip155:84532',
  testnet: true,
}

export const celo: AppKitNetwork = {
  id: 42220,
  name: 'Celo',
  nativeCurrency: { name: 'Celo', symbol: 'CELO', decimals: 18 },
  rpcUrls: { default: { http: ['https://forno.celo.org'] } },
  blockExplorers: { default: { name: 'Celoscan', url: 'https://celoscan.io' } },
  chainNamespace: 'eip155',
  caipNetworkId: 'eip155:42220',
  testnet: false,
}

/** Non-empty network tuple AppKit's `createAppKit({ networks })` expects. */
export const EVM_NETWORKS: [AppKitNetwork, ...AppKitNetwork[]] = [base, baseSepolia, celo, mainnet]
