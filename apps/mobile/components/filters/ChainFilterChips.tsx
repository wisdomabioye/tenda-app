/**
 * Settlement-chain filter, rendered as a horizontal chip row.
 *
 * Options come from the chain registry (`/v1/platform/chains`, cached in
 * `chain-registry.store`) — never a hardcoded list — so enabling a chain
 * stays a server config/seed change on both ends. The emitted value is the
 * CAIP-2 id the server's `chain_id` filter expects.
 */
import { ScrollView, StyleSheet } from 'react-native'
import { Chip } from '@/components/ui'
import { useChainRegistryStore } from '@/stores/chain-registry.store'
import { spacing } from '@/theme/tokens'

interface ChainFilterChipsProps {
  /** Active CAIP-2 chain id, or null for "All chains". */
  value: string | null
  onChange: (chain_id: string | null) => void
}

export function ChainFilterChips({ value, onChange }: ChainFilterChipsProps) {
  const chains = useChainRegistryStore((s) => s.chains)

  // Registry not loaded, or a single-chain deployment: a filter with one
  // option is noise, so render nothing rather than a dead control.
  // Exception: if a filter is ACTIVE, keep the row visible even when the
  // options collapse to one — a chain being disabled server-side while the
  // user has it selected would otherwise hide the only control that can
  // clear it, leaving them stuck on an invisible filter.
  if (chains === null || (chains.length < 2 && value === null)) return null

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={s.row}
    >
      <Chip label="All chains" selected={value === null} onPress={() => onChange(null)} />
      {chains.map((chain) => (
        <Chip
          key={chain.id}
          label={chain.display_name}
          selected={value === chain.id}
          // Single-select, and "All chains" is right there as the clear
          // affordance — so re-tapping the ACTIVE chip is a no-op, not a
          // reset. Toggle-to-clear made a second tap silently jump back to
          // all chains, which is exactly what someone does when they think
          // the first tap didn't register.
          onPress={() => onChange(chain.id)}
        />
      ))}
    </ScrollView>
  )
}

const s = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: spacing.xs,
    paddingBottom: spacing.md,
  },
})
