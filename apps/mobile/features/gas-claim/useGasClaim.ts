/**
 * The gas claim's whole client behaviour: read availability, take the claim,
 * and hold what the surfaces render.
 *
 * ONE hook, because both surfaces show the same thing about the same chain —
 * the wallet screen's card and the inline prompt on a chain with no gas. If
 * each fetched for itself they would disagree the moment one of them claimed,
 * and the screen would show a chain as both claimable and under way.
 */

import { useCallback, useEffect, useState } from 'react'
import { ApiClientError, type GasSeedAvailability } from '@tenda/shared'
import { api } from '@/api/client'
import { GAS_CLAIM_COPY } from './copy'

export interface GasClaimState {
  /** Availability per chain, in the order the server returned it. */
  chains: GasSeedAvailability[]
  /** True until the first read settles, so a card can hold its shape. */
  loading: boolean
  /** The chain id currently being claimed, or null. */
  claiming: string | null
  /** The last claim failure, already human-readable. */
  error: string | null
  /** Claim one chain's seed, then refresh so the state reflects the server. */
  claim(chain_id: string): Promise<void>
  /** Re-read availability — for a pull-to-refresh, or after a grant lands. */
  refresh(): Promise<void>
}

/**
 * Availability for the signed-in user.
 *
 * Deliberately NOT a store: this is per-user, per-request state with no
 * cross-screen lifetime worth keeping, and the wallet screen is the only host
 * (the prompt renders inside it). A module cache here would also have to be
 * registered for sign-out clearing, which is a cost with nothing to buy.
 */
export function useGasClaim(): GasClaimState {
  const [chains, setChains] = useState<GasSeedAvailability[]>([])
  const [loading, setLoading] = useState(true)
  const [claiming, setClaiming] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    try {
      const res = await api.wallet.gasSeedAvailability()
      setChains(res.chains)
    } catch {
      // Availability is an OFFER, not a fact the screen depends on: a failed
      // read renders no card at all rather than an error the user can do
      // nothing about, on a screen whose job is showing their balances.
      setChains([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const claim = useCallback(
    async (chain_id: string) => {
      setClaiming(chain_id)
      setError(null)
      try {
        await api.wallet.claimGasSeed({ chain_id })
        // Re-read rather than patching local state to 'in_progress': the server
        // decides the state, and it is the same read the card renders from, so
        // there is no second source to disagree with it. It also picks up the
        // idempotent answer when this was a second tap.
        await refresh()
      } catch (e) {
        // The server's message is written for this exact refusal — "verify your
        // phone", "claims are paused" — so it beats a generic sentence. But a
        // failure with NO message (a dropped connection) must still say
        // something: silence here is indistinguishable from a tap that never
        // registered.
        setError(e instanceof ApiClientError ? e.message : GAS_CLAIM_COPY.failed)
      } finally {
        setClaiming(null)
      }
    },
    [refresh],
  )

  return { chains, loading, claiming, error, claim, refresh }
}

/** The availability entry for one chain, or null when nothing is offered there. */
export function gasClaimForChain(
  chains: readonly GasSeedAvailability[],
  chain_id: string,
): GasSeedAvailability | null {
  return chains.find((c) => c.chain_id === chain_id) ?? null
}
