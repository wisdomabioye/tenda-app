import { View, StyleSheet } from 'react-native'
import { useUnistyles } from 'react-native-unistyles'
import { radius, spacing } from '@/theme/tokens'
import { Text } from '@/components/ui/Text'
import { Spacer } from '@/components/ui/Spacer'

/** Danger-toned block showing the active dispute's reason. */
export function DisputeReasonBlock({ reason }: { reason: string }) {
  const { theme } = useUnistyles()
  return (
    <View style={[s.block, { backgroundColor: theme.colors.feedback.danger.surface }]}>
      <Text weight="semibold" color={theme.colors.feedback.danger.text}>
        Dispute reason
      </Text>
      <Spacer size={4} />
      <Text variant="caption" color={theme.colors.feedback.danger.text}>
        {reason}
      </Text>
    </View>
  )
}

const s = StyleSheet.create({
  block: {
    borderRadius: radius.md,
    padding: spacing.md,
  },
})
