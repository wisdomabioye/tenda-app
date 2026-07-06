'use client'

/**
 * Mounts the Reown AppKit runtime and feeds its concrete signer into the
 * wallet-signer seam. With no `NEXT_PUBLIC_REOWN_PROJECT_ID` the whole wallet
 * layer stays inert — children render with a null signer and the sign UI
 * degrades to "not configured on this deployment".
 */
import { useState, type ReactNode } from 'react'
import { WagmiProvider } from 'wagmi'
import { QueryClientProvider } from '@tanstack/react-query'
import { WalletSignerProvider } from '@/providers/wallet-signer'
import type { WalletSigner } from '@/lib/resolution-sign'
import { initReown, reownProjectId, type ReownRuntime } from './config'
import { createReownSigner } from './signer'

interface Mounted {
  runtime: ReownRuntime
  signer: WalletSigner
}

export function ReownProvider({ children }: { children: ReactNode }) {
  const [mounted] = useState<Mounted | null>(() => {
    if (reownProjectId === undefined || reownProjectId.length === 0) return null
    const runtime = initReown(reownProjectId)
    return { runtime, signer: createReownSigner(runtime.modal, runtime.wagmiConfig) }
  })

  if (mounted === null) {
    return <WalletSignerProvider signer={null}>{children}</WalletSignerProvider>
  }

  return (
    <WagmiProvider config={mounted.runtime.wagmiConfig}>
      <QueryClientProvider client={mounted.runtime.queryClient}>
        <WalletSignerProvider signer={mounted.signer}>{children}</WalletSignerProvider>
      </QueryClientProvider>
    </WagmiProvider>
  )
}
