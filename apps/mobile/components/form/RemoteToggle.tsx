import { View, Pressable, StyleSheet } from 'react-native'
import { useUnistyles } from 'react-native-unistyles'
import { Globe } from 'lucide-react-native'
import { radius, spacing } from '@/theme/tokens'
import { Text } from '@/components/ui/Text'

interface RemoteToggleProps {
  value: boolean
  onChange: (remote: boolean) => void
}

export function RemoteToggle({ value, onChange }: RemoteToggleProps) {
  const { theme } = useUnistyles()

  return (
    <Pressable
      onPress={() => onChange(!value)}
      style={[
        s.row,
        {
          backgroundColor: value ? theme.colors.primaryTint : theme.colors.muted,
          borderColor: value ? theme.colors.primary : 'transparent',
        },
      ]}
    >
      <Globe size={16} color={value ? theme.colors.primary : theme.colors.textSub} />
      <View style={s.text}>
        <Text size={14} weight="semibold" color={value ? theme.colors.primary : theme.colors.text}>
          Remote gig
        </Text>
        <Text size={12} color={value ? theme.colors.primary : theme.colors.textFaint}>
          {value ? 'No physical location — visible globally' : 'Worker comes to a specific location'}
        </Text>
      </View>
    </Pressable>
  )
}

const s = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1.5,
  },
  text: { flex: 1 },
})
