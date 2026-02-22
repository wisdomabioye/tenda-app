import { View, Pressable, StyleSheet } from 'react-native'
import { useUnistyles } from 'react-native-unistyles'
import { radius, spacing } from '@/theme/tokens'
import { Text } from '@/components/ui/Text'

const DURATIONS: Array<{ label: string; seconds: number }> = [
  { label: '1h',  seconds: 3_600 },
  { label: '4h',  seconds: 14_400 },
  { label: '1d',  seconds: 86_400 },
  { label: '3d',  seconds: 259_200 },
  { label: '7d',  seconds: 604_800 },
  { label: '14d', seconds: 1_209_600 },
  { label: '30d', seconds: 2_592_000 },
]

interface DurationPickerProps {
  value: number          // seconds
  onChange: (seconds: number) => void
}

export function DurationPicker({ value, onChange }: DurationPickerProps) {
  const { theme } = useUnistyles()

  return (
    <View style={s.container}>
      <Text variant="label">Completion window</Text>
      <Text variant="caption" color={theme.colors.textFaint}>
        How long the worker has after accepting
      </Text>
      <View style={s.grid}>
        {DURATIONS.map((d) => {
          const selected = value === d.seconds
          return (
            <Pressable
              key={d.seconds}
              onPress={() => onChange(d.seconds)}
              style={[
                s.chip,
                {
                  backgroundColor: selected ? theme.colors.primary : theme.colors.muted,
                },
              ]}
            >
              <Text
                size={13}
                weight="semibold"
                color={selected ? theme.colors.onPrimary : theme.colors.text}
              >
                {d.label}
              </Text>
            </Pressable>
          )
        })}
      </View>
    </View>
  )
}

const s = StyleSheet.create({
  container: { gap: 8 },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  chip: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: radius.full,
  },
})
