'use client'

/**
 * The wallet a transaction on `chainId` will sign with, plus the "Switch
 * wallet" action — the reusable unit behind the confirm dialog's signer row.
 * The address is the SAME resolution dispatch uses (session-if-linked, else
 * primary linked wallet), so what the dialog previews is what actually
 * signs. Switching rides `switchToLinkedWallet`: drop the namespace's
 * session, let the user pick from the namespace-filtered list, refuse a
 * stranger pick by name. A dismissal is a change of mind, not an error.
 */
import { useCallback, useEffect, useReducer, useState } from 'react'
import { WalletError, findChain, pickWalletAddress } from '@tenda/shared'
import type { ChainNamespace } from '@tenda/shared'
import { sessionAddressFor } from '@/wallet/dispatch'
import { switchToLinkedWallet } from '@/wallet/send'
import { useAuthStore } from '@/stores/auth.store'

export interface SigningWallet {
  namespace: ChainNamespace | null
  /** Most-likely signer, or null when nothing is linked on this namespace. */
  address: string | null
  switching: boolean
  /** A failed switch (stranger pick / load failure); null otherwise. */
  error: string | null
  switchWallet: () => Promise<void>
}

export function useSigningWallet(chainId: string): SigningWallet {
  const ns = findChain(chainId)?.namespace ?? null
  const wallets = useAuthStore((s) => s.wallets)
  const ensureWallets = useAuthStore((s) => s.ensureWallets)
  // The live session is not reactive (the modal owns it) — re-read after a
  // switch settles; the wallets subscription covers trust-list changes.
  const [, rerender] = useReducer((n: number) => n + 1, 0)
  const [switching, setSwitching] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    void ensureWallets()
  }, [ensureWallets])

  const switchWallet = useCallback(async () => {
    if (ns === null || switching) return
    setSwitching(true)
    setError(null)
    try {
      await switchToLinkedWallet(ns)
    } catch (e) {
      if (!(e instanceof WalletError && e.code === 'declined')) {
        setError(e instanceof Error ? e.message : 'Could not switch wallets')
      }
    } finally {
      setSwitching(false)
      rerender()
    }
  }, [ns, switching])

  return {
    namespace: ns,
    address: ns === null ? null : pickWalletAddress(ns, sessionAddressFor(ns), wallets),
    switching,
    error,
    switchWallet,
  }
}
