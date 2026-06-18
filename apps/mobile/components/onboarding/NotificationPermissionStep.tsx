import { View, Pressable, StyleSheet } from 'react-native'
import { useUnistyles } from 'react-native-unistyles'
import { Bell } from 'lucide-react-native'
import { spacing } from '@/theme/tokens'
import { ScreenContainer, Text, Button, Spacer } from '@/components/ui'

/** Final onboarding step: ask for notification permission (skippable). */
export function NotificationPermissionStep({
  isRequesting,
  onAllow,
  onSkip,
}: {
  isRequesting: boolean
  onAllow: () => void
  onSkip: () => void
}) {
  const { theme } = useUnistyles()
  return (
    <ScreenContainer scroll={false} padding={false} edges={['left', 'right', 'bottom']}>
      <View style={s.permission}>
        <Spacer flex={1} />
        <View style={[s.permissionIcon, { backgroundColor: theme.colors.brand.primarySurface }]}>
          <Bell size={36} color={theme.colors.brand.primary} />
        </View>
        <Spacer size={spacing.md} />
        <Text variant="heading" align="center">Stay in the loop</Text>
        <Spacer size={spacing.sm} />
        <Text variant="body" align="center" color={theme.colors.content.secondary}>
          Get notified when someone accepts your gig, submits work, or when your payment is released.
        </Text>
        <Spacer flex={2} />
        <Button variant="primary" size="lg" fullWidth loading={isRequesting} onPress={onAllow}>
          Allow notifications
        </Button>
        <Spacer size={spacing.md} />
        <Pressable onPress={onSkip} style={s.skipBtn}>
          <Text variant="caption" color={theme.colors.content.tertiary} align="center">
            Not now
          </Text>
        </Pressable>
        <Spacer size={spacing.md} />
      </View>
    </ScreenContainer>
  )
}

const s = StyleSheet.create({
  permission: { flex: 1, paddingHorizontal: spacing.md, alignItems: 'center' },
  permissionIcon: { width: 80, height: 80, borderRadius: 40, alignItems: 'center', justifyContent: 'center' },
  skipBtn: { padding: spacing.xs },
})
