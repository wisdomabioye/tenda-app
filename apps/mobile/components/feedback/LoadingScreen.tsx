import { View, StyleSheet, Animated, Easing } from 'react-native'
import { useEffect, useRef } from 'react'
import { Image } from 'expo-image'
import { useUnistyles } from 'react-native-unistyles'
import { Text } from '@/components/ui/Text'
import { spacing } from '@/theme/tokens'

const BrandIcon = require('@/assets/images/tenda-icon-blue.png')

export function LoadingScreen() {
  const { theme } = useUnistyles()
  const pulse = useRef(new Animated.Value(0)).current

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 900, easing: Easing.out(Easing.quad), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 900, easing: Easing.in(Easing.quad), useNativeDriver: true }),
      ]),
    )
    animation.start()
    return () => animation.stop()
  }, [pulse])

  const ringStyle = {
    opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.4, 0.1] }),
    transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.5] }) }],
  }

  return (
    <View style={[s.container, { backgroundColor: theme.colors.background }]}>
      <View style={s.loaderWrap}>
        <Animated.View
          style={[
            s.ring,
            ringStyle,
            { borderColor: theme.colors.primary },
          ]}
        />
        <View style={[s.logoWrap, { backgroundColor: theme.colors.primaryTint }]}>
          <Image source={BrandIcon} style={s.brandIcon} contentFit="contain" />
        </View>
      </View>
    </View>
  )
}

const s = StyleSheet.create({
  container: {
    flex: 1,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  loaderWrap: {
    width: 120,
    height: 120,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ring: {
    position: 'absolute',
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 2,
  },
  logoWrap: {
    width: 84,
    height: 84,
    borderRadius: 42,
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandIcon: {
    width: 164,
    height: 164,
  },
  label: {
    marginTop: spacing.md,
  },
})
