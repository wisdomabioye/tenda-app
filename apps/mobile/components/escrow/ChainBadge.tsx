import { View, StyleSheet } from 'react-native'
import { useUnistyles } from 'react-native-unistyles'
import { Text } from '@/components/ui/Text'

const CHAIN_LABEL: ReadonlyArray<{ prefix: string; label: string }> = [
  { prefix: 'solana:', label: 'Solana' },
  { prefix: 'eip155:8453', label: 'BASE' },
  { prefix: 'eip155:84532', label: 'BASE' },
  { prefix: 'eip155:42220', label: 'CELO' },
]

export function chainLabel(chain_id: string): string {
  return CHAIN_LABEL.find((c) => chain_id.startsWith(c.prefix))?.label ?? 'Unknown'
}

/** Small chain marker for escrow detail (stage-3 § mobile). */
export function ChainBadge({ chainId }: { chainId: string }) {
  const { theme } = useUnistyles()
  return (
    <View style={[s.badge, { backgroundColor: theme.colors.surface.inset }]}>
      <Text size={10.5} weight="semibold" color={theme.colors.content.secondary}>
        {chainLabel(chainId)}
      </Text>
    </View>
  )
}

const s = StyleSheet.create({
  badge: {
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    alignSelf: 'flex-start',
  },
})
