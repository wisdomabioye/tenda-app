import { useEffect, useRef } from 'react'
import { View, StyleSheet, Animated, Easing } from 'react-native'
import { useUnistyles } from 'react-native-unistyles'
import { Activity } from 'lucide-react-native'
import { radius, spacing, typography } from '@/theme/tokens'
import { Text } from './Text'

interface LiveChipProps {
  label?: string
}

const s = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: radius.full,
    alignSelf: 'flex-start' as const,
  },
  pulseWrap: {
    width: 10,
    height: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pulseDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  pulseRing: {
    position: 'absolute',
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 1,
  },
})

export function LiveChip({ label = 'Live' }: LiveChipProps) {
  const { theme } = useUnistyles()
  const pulse = useRef(new Animated.Value(0)).current

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 1200,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration: 0,
          useNativeDriver: true,
        }),
      ]),
    )

    animation.start()
    return () => animation.stop()
  }, [pulse])

  const ringStyle = {
    opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.6, 0] }),
    transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.8] }) }],
  }

  return (
    <View style={[s.container, { backgroundColor: theme.colors.successTint }]}>
      <Activity size={14} color={theme.colors.onSuccess} />
      <Text size={typography.sizes.sm} weight="medium" color={theme.colors.onSuccess}>
        {label}
      </Text>
      <View style={s.pulseWrap}>
        <Animated.View
          style={[
            s.pulseRing,
            ringStyle,
            { borderColor: theme.colors.success },
          ]}
        />
        <View style={[s.pulseDot, { backgroundColor: theme.colors.success }]} />
      </View>
    </View>
  )
}
