import { View, StyleSheet } from 'react-native'
import { useRouter, Stack } from 'expo-router'
import { useUnistyles } from 'react-native-unistyles'
import { FileQuestion } from 'lucide-react-native'
import { spacing } from '@/theme/tokens'
import { ScreenContainer } from '@/components/ui/ScreenContainer'
import { Text } from '@/components/ui/Text'
import { Button } from '@/components/ui/Button'
import { Spacer } from '@/components/ui/Spacer'

export default function NotFoundScreen() {
  const router = useRouter()
  const { theme } = useUnistyles()

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <ScreenContainer scroll={false} edges={['top', 'left', 'right', 'bottom']}>
        <View style={s.container}>
          <View style={[s.iconCircle, { backgroundColor: theme.colors.primaryTint }]}>
            <FileQuestion size={48} color={theme.colors.primary} />
          </View>

          <Spacer size={spacing.lg} />

          <Text variant="heading" align="center">
            404
          </Text>

          <Spacer size={spacing.sm} />

          <Text variant="body" align="center" color={theme.colors.textSub}>
            The page you're looking for{'\n'}doesn't exist or has been moved.
          </Text>

          <Spacer size={spacing.xl} />

          <Button
            variant="primary"
            size="lg"
            onPress={() => router.replace('/(tabs)/home')}
          >
            Go Home
          </Button>
        </View>
      </ScreenContainer>
    </>
  )
}

const s = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
  },
  iconCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
})
