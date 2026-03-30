import { Fragment } from 'react'
import { View, StyleSheet } from 'react-native'
import { Check } from 'lucide-react-native'
import { useUnistyles } from 'react-native-unistyles'
import { spacing } from '@/theme/tokens'
import { Text } from '@/components/ui/Text'

export const STEPS = ['Details', 'Timing', 'Payment', 'Review'] as const
export type Step = 0 | 1 | 2 | 3

const DOT  = 26
const LINE = 2

export function StepIndicator({ current }: { current: Step }) {
  const { theme } = useUnistyles()

  return (
    <View style={s.container}>
      <View style={s.row}>
        {STEPS.map((label, i) => {
          const done   = i < current
          const active = i === current

          const dotBg     = done ? theme.colors.feedback.success.base : active ? theme.colors.brand.primary : 'transparent'
          const dotBorder = done ? theme.colors.feedback.success.base : active ? theme.colors.brand.primary : theme.colors.border.subtle
          const labelColor = active ? theme.colors.brand.primary : done ? theme.colors.feedback.success.base : theme.colors.content.tertiary

          return (
            <Fragment key={label}>
              {i > 0 && (
                <View style={[s.line, { backgroundColor: i <= current ? theme.colors.feedback.success.base : theme.colors.border.subtle }]} />
              )}

              <View style={s.cell}>
                <View style={[s.dot, { backgroundColor: dotBg, borderColor: dotBorder }]}>
                  {done ? (
                    <Check size={12} color="#fff" strokeWidth={3} />
                  ) : (
                    <Text style={[s.num, { color: active ? '#fff' : theme.colors.content.tertiary }]}>
                      {i + 1}
                    </Text>
                  )}
                </View>
                <Text size={10} weight={active ? 'semibold' : 'regular'} color={labelColor} style={s.label}>
                  {label}
                </Text>
              </View>
            </Fragment>
          )
        })}
      </View>
    </View>
  )
}

const s = StyleSheet.create({
  container: {
    paddingHorizontal: spacing.xl,
    paddingVertical:   spacing.md,
  },
  row: {
    flexDirection: 'row',
    alignItems:    'flex-start',
  },
  cell: {
    alignItems: 'center',
    gap:        6,
  },
  line: {
    flex:        1,
    height:      LINE,
    marginTop:   (DOT - LINE) / 2,  // vertically center line with dots
  },
  dot: {
    width:          DOT,
    height:         DOT,
    borderRadius:   DOT / 2,
    borderWidth:    1.5,
    alignItems:     'center',
    justifyContent: 'center',
  },
  num: {
    fontSize:            11,
    fontWeight:          '700',
    includeFontPadding:  false,
    textAlignVertical:   'center',
  },
  label: {
    textAlign: 'center',
  },
})
