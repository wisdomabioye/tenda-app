/**
 * The gas claim as ONE renderer a host hands to its chain rows.
 *
 * This is the whole public surface of the feature on mobile now. A host writes:
 *
 *   const renderGasChip = useGasClaimChip()
 *   <WalletBalanceRows balances={balances} renderChainAction={renderGasChip} />
 *
 * — one import, one hook call, one prop. Everything else (what to fetch, which
 * chains may be offered, what the chip says, what happens when a claim fails)
 * lives in this directory, which is what keeps the feature removable: see
 * ./index.ts.
 *
 * WHY THE HOOK OWNS THE FETCH rather than each chip fetching for itself: there
 * is one availability read for the whole screen, and per-chip reads would mean
 * N requests that can disagree the moment one of them claims — one row showing
 * "on its way" while its neighbour still offers the grant.
 */

import { useCallback, useEffect } from 'react'
import type { ReactNode } from 'react'
import { showToast } from '@/components/ui'
import { GasClaimChip } from './GasClaimChip'
import { gasClaimForChain, useGasClaim } from './useGasClaim'

/**
 * A renderer for one chain's claim affordance: the chip, or null.
 *
 * Returns null for every chain that is not claimable RIGHT NOW — no grant on
 * offer, already claimed, in flight, phone unverified, hot wallet empty. Those
 * are not silences by omission; they are the design. A refusal is an answer to a
 * tap, not a permanent notice on someone's balance screen.
 */
export function useGasClaimChip(): (chain_id: string) => ReactNode {
  const { chains, claiming, error, claim } = useGasClaim()

  // A failed claim has to say something, and with no card on screen there is
  // nowhere for it to sit. A toast is the repo's convention for exactly this —
  // fire-and-forget feedback with no decision attached — and the message is
  // already human-readable: `useGasClaim` prefers the server's own sentence
  // ("verify your phone number…") and falls back to its own only when a failure
  // carried none.
  //
  // Safe to key on the value: `useGasClaim` sets `error` to null at the START of
  // every claim, so two identical failures in a row still read as null → X → and
  // fire twice. Without that reset the second one would be silent.
  useEffect(() => {
    if (error !== null) showToast('error', error)
  }, [error])

  return useCallback(
    (chain_id: string) => {
      const offer = gasClaimForChain(chains, chain_id)
      if (offer === null || !offer.available) return null
      return <GasClaimChip offer={offer} claiming={claiming === chain_id} onClaim={claim} />
    },
    [chains, claiming, claim],
  )
}
