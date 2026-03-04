import { StyleSheet } from 'react-native'
import Animated, { useAnimatedStyle, withTiming } from 'react-native-reanimated'
import { useUnistyles } from 'react-native-unistyles'

interface OnboardingDotsProps {
  total: number
  current: number
}

interface DotProps {
  active: boolean
}

function Dot({ active }: DotProps) {
  const { theme } = useUnistyles()

  const style = useAnimatedStyle(() => ({
    width: withTiming(active ? 20 : 8, { duration: 250 }),
    backgroundColor: withTiming(
      active ? theme.colors.primary : theme.colors.border,
      { duration: 250 },
    ),
  }))

  return <Animated.View style={[s.dot, style]} />
}

export function OnboardingDots({ total, current }: OnboardingDotsProps) {
  return (
    <Animated.View style={s.row}>
      {Array.from({ length: total }, (_, i) => (
        <Dot key={i} active={i === current} />
      ))}
    </Animated.View>
  )
}

const s = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  dot: {
    height: 8,
    borderRadius: 4,
  },
})
