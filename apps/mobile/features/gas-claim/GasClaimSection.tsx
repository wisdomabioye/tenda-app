/**
 * The wallet screen's gas-claim block: every chain worth saying something
 * about, with its own card.
 *
 * This is the component a HOST renders. It owns the hook, so the screen adds
 * one JSX line and no state — which is the point of the module (see ./index.ts).
 */

import { View, StyleSheet } from 'react-native'
import { useUnistyles } from 'react-native-unistyles'
import type { GasSeedAvailability } from '@tenda/shared'
import { Text } from '@/components/ui'
import { GasClaimCard } from './GasClaimCard'
import { useGasClaim } from './useGasClaim'

export interface GasClaimSectionProps {
  /** Which wallet each chain would pay, by chain id — from the wallet screen's balances. */
  walletByChain?: Readonly<Record<string, string>>
}

/**
 * Which offers are worth rendering at all.
 *
 * A chain that simply has no grant (`not_offered`) is silence, not a card: on a
 * deployment where one chain seeds and three do not, listing all four would
 * turn a small piece of good news into a wall of "no". Everything else is shown
 * — including refusals the user can act on ("verify your phone") and grants
 * already under way, which is the state a double-tapper needs to see.
 */
function worthShowing(offer: GasSeedAvailability): boolean {
  return offer.reason !== 'not_offered'
}

export function GasClaimSection({ walletByChain = {} }: GasClaimSectionProps) {
  const { theme } = useUnistyles()
  const { chains, loading, claiming, error, claim } = useGasClaim()
  const offers = chains.filter(worthShowing)

  // Nothing to say, and nothing to hold space for. The card is an OFFER, so its
  // absence must be invisible rather than an empty state — a "no gas grants"
  // panel on every wallet screen would be a permanent apology.
  if (loading || offers.length === 0) return null

  return (
    <View style={s.wrap}>
      {offers.map((offer) => (
        <GasClaimCard
          key={offer.chain_id}
          offer={offer}
          claiming={claiming === offer.chain_id}
          onClaim={claim}
          walletAddress={walletByChain[offer.chain_id] ?? null}
        />
      ))}
      {error !== null && (
        <Text size={12.5} color={theme.colors.feedback.danger.base}>
          {error}
        </Text>
      )}
    </View>
  )
}

const s = StyleSheet.create({
  wrap: { gap: 10 },
})
