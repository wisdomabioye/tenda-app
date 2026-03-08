import { View, Pressable, Image, StyleSheet } from 'react-native'
import { FileText, Film, Play } from 'lucide-react-native'
import { useUnistyles } from 'react-native-unistyles'
import { spacing, radius } from '@/theme/tokens'
import { Text } from '@/components/ui/Text'
import type { GigProof } from '@tenda/shared'

const PROOF_SIZE = 72

interface Props {
  proofs: GigProof[]
  onProofPress: (proof: GigProof) => void
}

export function GigProofsGrid({ proofs, onProofPress }: Props) {
  const { theme } = useUnistyles()

  return (
    <View style={s.grid}>
      {proofs.map((proof) => (
        <Pressable
          key={proof.id}
          style={[s.item, { backgroundColor: theme.colors.muted }]}
          onPress={() => onProofPress(proof)}
        >
          {proof.type === 'image' ? (
            <Image source={{ uri: proof.url }} style={s.thumb} />
          ) : (
            <View style={s.icon}>
              {proof.type === 'video'
                ? <Film size={24} color={theme.colors.textSub} />
                : <FileText size={24} color={theme.colors.textSub} />}
              <Text size={10} color={theme.colors.textSub} numberOfLines={1}>
                {proof.type}
              </Text>
            </View>
          )}
          {proof.type === 'video' && (
            <View style={[s.playBadge, { backgroundColor: theme.colors.primary }]}>
              <Play size={8} color={theme.colors.onPrimary} fill={theme.colors.onPrimary} />
            </View>
          )}
        </Pressable>
      ))}
    </View>
  )
}

const s = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  item: {
    width: PROOF_SIZE,
    height: PROOF_SIZE,
    borderRadius: radius.sm,
    overflow: 'hidden',
  },
  thumb: { width: PROOF_SIZE, height: PROOF_SIZE },
  icon:  { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 4 },
  playBadge: {
    position: 'absolute',
    bottom: 4,
    right: 4,
    width: 16,
    height: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
})
