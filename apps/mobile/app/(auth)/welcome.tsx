import { View, StyleSheet } from 'react-native'
import { useRouter } from 'expo-router'
import { Image } from 'expo-image'
import { useUnistyles } from 'react-native-unistyles'
import { spacing } from '@/theme/tokens'
import { ScreenContainer } from '@/components/ui/ScreenContainer'
import { Text } from '@/components/ui/Text'
import { Button } from '@/components/ui/Button'
import { Spacer } from '@/components/ui/Spacer'

const Logo = require('@/assets/images/logo.png')

export default function WelcomeScreen() {
  const router = useRouter()
  const { theme } = useUnistyles()

  return (
    <ScreenContainer scroll={false} padding={false}>
      <View style={s.screen}>
        <Spacer flex={1} />

        <View style={s.center}>
          <Image source={Logo} style={s.logo} contentFit="contain" />
          <Spacer size={24} />
          <Text variant="heading" align="center">
            Work. Earn. Instantly.
          </Text>
          <Spacer size={10} />
          <Text variant="body" align="center" color={theme.colors.textSub}>
            Find gigs. Complete tasks.{'\n'}Get paid in seconds.
          </Text>
        </View>

        <Spacer flex={2} />

        <View style={s.cta}>
          <Button
            variant="primary"
            size="xl"
            fullWidth
            onPress={() => router.push('/(auth)/connect-wallet')}
          >
            Continue
          </Button>
        </View>
      </View>
    </ScreenContainer>
  )
}

const s = StyleSheet.create({
  screen: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
    marginBottom: spacing['3xl'],
  },
  center: { alignItems: 'center' },
  logo: { width: 80, height: 80 },
  cta: { width: '100%' },
})
