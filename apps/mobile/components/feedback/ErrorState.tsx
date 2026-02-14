import { View, StyleSheet, type ViewStyle } from 'react-native'
import { useRouter } from 'expo-router'
import { useUnistyles } from 'react-native-unistyles'
import { AlertTriangle } from 'lucide-react-native'
import { spacing } from '@/theme/tokens'
import { Text } from '@/components/ui/Text'
import { Button } from '@/components/ui/Button'
import { Spacer } from '@/components/ui/Spacer'

interface ErrorStateProps {
  title: string
  description?: string
  ctaLabel?: string
  onCtaPress?: () => void
  secondaryLabel?: string
  onSecondaryPress?: () => void
  style?: ViewStyle
}

export function ErrorState({
  title,
  description,
  ctaLabel = 'Go back',
  onCtaPress,
  secondaryLabel,
  onSecondaryPress,
  style,
}: ErrorStateProps) {
  const { theme } = useUnistyles()
  const router = useRouter()

  const handleCtaPress = onCtaPress ?? (() => router.back())

  return (
    <View style={[s.container, style]}>
      <View style={[s.iconWrap, { backgroundColor: theme.colors.warningTint }]}>
        <AlertTriangle size={28} color={theme.colors.onWarning} />
      </View>

      <Text variant="heading" align="center">
        {title}
      </Text>

      {description ? (
        <>
          <Spacer size={spacing.sm} />
          <Text variant="body" align="center" color={theme.colors.textSub}>
            {description}
          </Text>
        </>
      ) : null}

      <Spacer size={spacing.lg} />

      <Button variant="primary" size="lg" fullWidth onPress={handleCtaPress}>
        {ctaLabel}
      </Button>

      {secondaryLabel ? (
        <>
          <Spacer size={spacing.sm} />
          <Button variant="ghost" size="md" fullWidth onPress={onSecondaryPress}>
            {secondaryLabel}
          </Button>
        </>
      ) : null}
    </View>
  )
}

const s = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  iconWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
})
