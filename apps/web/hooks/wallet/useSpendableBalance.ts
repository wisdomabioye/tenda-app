import { useCallback, useEffect, useRef, useState } from 'react'
import type { AssetBalance } from '@tenda/shared'
import { readSpendableBalance } from '@tenda/shared'
import { resolveSignersForChain } from '@/wallet/dispatch'
import { selectChainById, useChainRegistryStore } from '@/stores/chain-registry.store'

/**
 * Web port of mobile's hooks/useSpendableBalance (mount ≈ focus — the web
 * page mounts fresh on navigation, so the focus refresh becomes a mount
 * effect; `refresh` stays for explicit re-reads).
 *
 * 'loading' covers both the in-flight read and a registry that hasn't landed
 * yet. At 'ready', `balance === null` means UNKNOWN — no linked wallet, the
 * chain isn't in the registry, or a read failed. It NEVER means zero.
 * Advisory UI must stay silent on unknown rather than tell the user they're
 * short.
 */
export type SpendableBalanceStatus = 'loading' | 'ready'

interface UseSpendableBalanceResult {
  /** The most of this asset ONE transaction could move, across linked wallets. */
  balance: AssetBalance | null
  status: SpendableBalanceStatus
  refresh: () => void
}

/** Identifies which (chain, asset) an answer belongs to. */
function keyOf(chainId: string, assetId: string): string {
  return `${chainId}|${assetId}`
}

/**
 * Keyed on `chainId` + `assetId` ONLY. Callers compare against an amount that
 * changes as the user types (the gig budget field); depending on that amount
 * here would fire one RPC per keystroke. The amount belongs in the
 * comparison, never in the fetch.
 */
export function useSpendableBalance(chainId: string, assetId: string): UseSpendableBalanceResult {
  const chains = useChainRegistryStore((s) => s.chains)
  // The answer is stored WITH the key it answers, so a key change invalidates
  // it by derivation rather than by clearing state. Re-reading the same key
  // keeps the previous answer on screen until the new one lands, while a
  // stale answer for another chain can never be displayed.
  const [answer, setAnswer] = useState<{ key: string; balance: AssetBalance | null } | null>(null)
  // Discards a read whose key the caller has already moved on from.
  const runIdRef = useRef(0)

  const chain = selectChainById(chains, chainId)

  const refresh = useCallback(() => {
    const runId = (runIdRef.current += 1)
    const key = keyOf(chainId, assetId)
    const owners = resolveSignersForChain(chainId)

    if (chain === null || owners.length === 0) {
      // A null chain while the registry is still loading is not an answer —
      // leave state untouched so a late registry re-renders into a real read
      // instead of latching an "unknown" the user never escapes. The answer
      // lands on a microtask so mount-effect callers never set state
      // synchronously inside the effect (web's stricter lint).
      if (chains === null) return
      void Promise.resolve().then(() => {
        if (runId !== runIdRef.current) return
        setAnswer({ key, balance: null })
      })
      return
    }

    readSpendableBalance(owners, chain, assetId)
      .then((balance) => {
        if (runId !== runIdRef.current) return
        setAnswer({ key, balance })
      })
      .catch(() => {
        // Unknown, not zero.
        if (runId !== runIdRef.current) return
        setAnswer({ key, balance: null })
      })
  }, [chainId, assetId, chain, chains])

  useEffect(() => {
    refresh()
  }, [refresh])

  const fresh = answer !== null && answer.key === keyOf(chainId, assetId)
  return {
    balance: fresh ? answer.balance : null,
    status: fresh ? 'ready' : 'loading',
    refresh,
  }
}
