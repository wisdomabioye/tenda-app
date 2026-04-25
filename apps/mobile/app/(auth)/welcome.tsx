import { View, Pressable, StyleSheet } from 'react-native'
import { useRouter } from 'expo-router'
import { Image } from 'expo-image'
import { useUnistyles } from 'react-native-unistyles'
import { typography } from '@/theme/tokens'
import { ScreenContainer } from '@/components/ui/ScreenContainer'
import { Text } from '@/components/ui/Text'
import { Button } from '@/components/ui/Button'

const Logo = require('@/assets/images/logo.png')

export default function WelcomeScreen() {
  const router = useRouter()
  const { theme } = useUnistyles()

  return (
    <ScreenContainer scroll={false} padding={false} edges={['left', 'right', 'bottom']}>
      <View style={[s.screen, { backgroundColor: theme.colors.surface.background }]}>
        <View style={s.heroStack}>
          <View style={[s.logoWrap, { shadowColor: theme.colors.brand.primary }]}>
            <Image source={Logo} style={s.logo} contentFit="contain" />
          </View>

          <Text style={[s.heroTitle, { color: theme.colors.content.primary }]}>
            Work. Earn. Instantly.
          </Text>

          <Text style={[s.heroBody, { color: theme.colors.content.secondary }]}>
            {'Find gigs. Complete tasks.\nGet paid in seconds.'}
          </Text>
        </View>

        <View style={s.ctaStack}>
          <Button
            variant="primary"
            size="xl"
            fullWidth
            onPress={() => router.push('/onboarding')}
          >
            Continue
          </Button>
          <Pressable hitSlop={4}>
            <Text style={[s.tos, { color: theme.colors.content.tertiary }]}>
              By continuing you agree to our{' '}
              <Text style={[s.tosBold, { color: theme.colors.content.secondary }]}>Terms</Text>
              {' '}and{' '}
              <Text style={[s.tosBold, { color: theme.colors.content.secondary }]}>Privacy</Text>.
            </Text>
          </Pressable>
        </View>
      </View>
    </ScreenContainer>
  )
}

const s = StyleSheet.create({
  screen: {
    flex: 1,
  },
  heroStack: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
    paddingTop: 32,
  },
  logoWrap: {
    width: 88,
    height: 88,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 32,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.20,
    shadowRadius: 24,
    elevation: 6,
  },
  logo: {
    width: 80,
    height: 80,
  },
  heroTitle: {
    fontFamily: typography.fonts.display.bold,
    fontSize: 44,
    lineHeight: 46,
    fontWeight: '700',
    letterSpacing: -1.32,
    textAlign: 'center',
    marginBottom: 14,
  },
  heroBody: {
    fontSize: 15,
    lineHeight: 23,
    textAlign: 'center',
    maxWidth: 280,
  },
  ctaStack: {
    paddingHorizontal: 20,
    paddingBottom: 28,
    gap: 12,
  },
  tos: {
    fontSize: 11.5,
    lineHeight: 17,
    textAlign: 'center',
    paddingHorizontal: 20,
  },
  tosBold: {
    fontWeight: '600',
  },
})
