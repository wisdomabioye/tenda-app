import { useCallback, useState } from 'react'
import { useFocusEffect } from 'expo-router'
import { PublicKey } from '@solana/web3.js'
import { getBalance } from '@/wallet'
import { useAuthStore } from '@/stores/auth.store'

/**
 * Connected wallet's native balance in lamports; null while unknown.
 * Refreshes on screen focus — drives the stage-8 "Add funds" CTA on gig
 * creation (mobile-side orchestration only; no server coupling).
 */
export function useWalletBalance(): { balanceLamports: number | null; refresh: () => void } {
  const walletAddress = useAuthStore((s) => s.walletAddress)
  const [balanceLamports, setBalance] = useState<number | null>(null)

  const refresh = useCallback(() => {
    if (walletAddress === null) {
      setBalance(null)
      return
    }
    getBalance(new PublicKey(walletAddress))
      .then(setBalance)
      .catch(() => {
        // RPC hiccup — keep the last known value; CTA stays advisory.
      })
  }, [walletAddress])

  useFocusEffect(
    useCallback(() => {
      refresh()
    }, [refresh]),
  )

  return { balanceLamports, refresh }
}
