import { View, StyleSheet } from 'react-native'
import { useUnistyles } from 'react-native-unistyles'
import { spacing } from '@/theme/tokens'
import { Text } from '@/components/ui/Text'

export const STEPS = ['Offer', 'Timing', 'Payment', 'Review'] as const
export type Step = 0 | 1 | 2 | 3

export function StepIndicator({ current }: { current: Step }) {
  const { theme } = useUnistyles()
  return (
    <View style={s.row}>
      {STEPS.map((label, i) => {
        const done   = i < current
        const active = i === current
        const color  = active
          ? theme.colors.primary
          : done
            ? theme.colors.success
            : theme.colors.textFaint
        return (
          <View key={label} style={s.item}>
            <View style={[s.dot, { borderColor: color, backgroundColor: done ? color : 'transparent' }]}>
              {!done && (
                <Text size={10} weight="bold" color={active ? theme.colors.primary : theme.colors.textFaint}>
                  {i + 1}
                </Text>
              )}
            </View>
            <Text size={10} color={color} weight={active ? 'semibold' : 'regular'}>{label}</Text>
            {i < STEPS.length - 1 && (
              <View style={[s.line, { backgroundColor: done ? theme.colors.success : theme.colors.borderFaint }]} />
            )}
          </View>
        )
      })}
    </View>
  )
}

const s = StyleSheet.create({
  row:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, paddingVertical: spacing.md },
  item: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  dot:  { width: 20, height: 20, borderRadius: 10, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  line: { width: 24, height: 2, borderRadius: 1 },
})
