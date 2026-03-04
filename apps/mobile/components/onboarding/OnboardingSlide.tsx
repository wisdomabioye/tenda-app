import type { ReactNode } from 'react'
import { View, StyleSheet } from 'react-native'
import { useUnistyles } from 'react-native-unistyles'
import type { LucideIcon } from 'lucide-react-native'
import { spacing } from '@/theme/tokens'
import { Text, Spacer } from '@/components/ui'

interface OnboardingSlideProps {
  Icon: LucideIcon
  title: string
  body: string
  children?: ReactNode
}

export function OnboardingSlide({ Icon, title, body, children }: OnboardingSlideProps) {
  const { theme } = useUnistyles()

  return (
    <View style={s.slide}>
      <Spacer flex={1} />

      <View style={s.hero}>
        <View style={[s.iconCircle, { backgroundColor: theme.colors.primaryTint }]}>
          <Icon size={36} color={theme.colors.primary} />
        </View>
        <Spacer size={spacing.md} />
        <Text variant="heading" align="center">{title}</Text>
        <Spacer size={spacing.sm} />
        <Text variant="body" align="center" color={theme.colors.textSub}>{body}</Text>
      </View>

      {children && (
        <>
          <Spacer size={spacing.lg} />
          <View style={s.extra}>{children}</View>
        </>
      )}

      <Spacer flex={2} />
    </View>
  )
}

const s = StyleSheet.create({
  slide: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: spacing.md,
  },
  hero: {
    alignItems: 'center',
    width: '100%',
  },
  iconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  extra: {
    width: '100%',
  },
})
