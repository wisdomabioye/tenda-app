/**
 * Reown AppKit runtime for the admin. Built once, lazily, on the client the
 * first time a project id is present. Kept out of the React tree so the
 * side-effectful `createAppKit` (a singleton web-component modal) and the
 * Wagmi config are constructed exactly once regardless of re-renders/StrictMode.
 *
 * Degradation: with no `NEXT_PUBLIC_REOWN_PROJECT_ID`, `reownProjectId` is
 * undefined and the provider never calls `initReown` — the wallet-signer seam
 * stays null and the sign UI shows "not configured". No wallet code runs.
 */
import { createAppKit } from '@reown/appkit/react'
import type { AppKit } from '@reown/appkit/react'
import { WagmiAdapter } from '@reown/appkit-adapter-wagmi'
import { SolanaAdapter } from '@reown/appkit-adapter-solana'
import { cookieStorage, createStorage, type Config } from 'wagmi'
import { QueryClient } from '@tanstack/react-query'
import { appKitNetworks, evmNetworks } from './networks'

export const reownProjectId = process.env.NEXT_PUBLIC_REOWN_PROJECT_ID

const metadata = {
  name: 'Tenda Admin',
  description: 'Tenda admin — dispute-resolution signing',
  url: typeof window !== 'undefined' ? window.location.origin : 'https://admin.tenda.app',
  icons: [],
}

export interface ReownRuntime {
  modal: AppKit
  wagmiConfig: Config
  queryClient: QueryClient
}

let runtime: ReownRuntime | undefined

/** Build (or reuse) the AppKit runtime. Call only when `reownProjectId` is set. */
export function initReown(projectId: string): ReownRuntime {
  if (runtime !== undefined) return runtime

  const wagmiAdapter = new WagmiAdapter({
    networks: evmNetworks,
    projectId,
    ssr: true,
    storage: createStorage({ storage: cookieStorage }),
  })

  const modal = createAppKit({
    adapters: [wagmiAdapter, new SolanaAdapter()],
    networks: appKitNetworks,
    projectId,
    metadata,
    // Admin is a signing surface, not an onramp — keep the modal to
    // wallet-connect only.
    features: { analytics: false, email: false, socials: [], swaps: false, onramp: false },
  })

  runtime = { modal, wagmiConfig: wagmiAdapter.wagmiConfig, queryClient: new QueryClient() }
  return runtime
}
