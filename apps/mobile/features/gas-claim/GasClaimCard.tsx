/**
 * The gas-claim surface. ONE component, two placements.
 *
 * `variant="card"` is the findable one on the wallet screen; `variant="inline"`
 * is the compact form shown against a chain the user holds no gas on — the
 * moment the claim is most worth offering. They render the same states from the
 * same hook, because a user who sees "on its way" in one place and "claim" in
 * the other has been told the app is broken.
 *
 * A host renders this and nothing else: no state, no fetching, no copy. That is
 * what keeps the feature removable — see ./index.ts.
 */

import { View, StyleSheet } from 'react-native'
import { useUnistyles } from 'react-native-unistyles'
import { formatAssetAmount, nativeAssetIdOf, truncateWallet } from '@tenda/shared'
import type { GasSeedAvailability } from '@tenda/shared'
import { Text, Button } from '@/components/ui'
import { useChainRegistryStore, selectChainById } from '@/stores/chain-registry.store'
import { GAS_CLAIM_COPY, gasClaimMessage } from './copy'

export interface GasClaimCardProps {
  /** One chain's availability, from `useGasClaim`. */
  offer: GasSeedAvailability
  /** True while THIS chain's claim is in flight. */
  claiming: boolean
  onClaim: (chain_id: string) => void
  /** The wallet the grant will be paid to, so it is never a surprise. */
  walletAddress?: string | null
  variant?: 'card' | 'inline'
}

/**
 * The grant as a person reads it — "0.01 OG" — or null when the chain registry
 * has not loaded, or carries no native asset for this chain.
 *
 * Formatted from the REGISTRY rather than from a table here: `nativeAssetIdOf`
 * is the same rule the balance rows use to label the gas figure directly above
 * this card, and two rules would let the two disagree about what the token is
 * called. Null renders as no amount at all, never as a bare base-unit integer —
 * "10000000000000000 gas" is worse than saying nothing.
 */
function useGrantAmount(offer: GasSeedAvailability): string | null {
  const chains = useChainRegistryStore((s) => s.chains)
  if (offer.amount_raw === null) return null
  const chain = selectChainById(chains, offer.chain_id)
  if (chain === null) return null
  const assetId = nativeAssetIdOf(chain)
  return assetId === null ? null : formatAssetAmount(offer.amount_raw, assetId)
}

export function GasClaimCard({
  offer,
  claiming,
  onClaim,
  walletAddress = null,
  variant = 'card',
}: GasClaimCardProps) {
  const { theme } = useUnistyles()
  const amount = useGrantAmount(offer)
  const inline = variant === 'inline'

  return (
    <View
      style={[
        s.wrap,
        inline ? s.inline : s.card,
        { backgroundColor: theme.colors.surface.card, borderColor: theme.colors.border.default },
      ]}
    >
      <View style={s.body}>
        <Text size={inline ? 13.5 : 15} weight="semibold">
          {inline ? GAS_CLAIM_COPY.promptTitle : GAS_CLAIM_COPY.title}
          {amount !== null && ` · ${amount}`}
        </Text>
        <Text size={12.5} color={theme.colors.content.secondary}>
          {gasClaimMessage(offer.state, offer.reason, offer.available)}
        </Text>
        {/* WHICH wallet gets it. Only when a claim is actually on offer: on a
            refused or already-claimed chain the address is noise, and after a
            grant the wallet screen's own rows are the better answer. */}
        {offer.available && walletAddress !== null && (
          <Text size={12} color={theme.colors.content.tertiary}>
            Paid to {truncateWallet(walletAddress)}
          </Text>
        )}
      </View>

      {/* The action exists ONLY while the server says a claim is available.
          `in_progress` and `claimed` must never render it — re-offering a grant
          the user already holds is the mistake this whole surface is shaped
          around. */}
      {offer.available && (
        <Button
          variant={inline ? 'outline' : 'primary'}
          size={inline ? 'sm' : 'md'}
          loading={claiming}
          onPress={() => onClaim(offer.chain_id)}
          accessibilityLabel={`${GAS_CLAIM_COPY.action} on ${offer.chain_id}`}
        >
          {GAS_CLAIM_COPY.action}
        </Button>
      )}
    </View>
  )
}

const s = StyleSheet.create({
  wrap: { borderWidth: 1, gap: 10 },
  card: { borderRadius: 14, padding: 14 },
  inline: { borderRadius: 10, padding: 10, gap: 8 },
  body: { gap: 3 },
})
