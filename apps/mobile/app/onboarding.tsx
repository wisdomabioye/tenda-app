import { useState } from 'react'
import { View, StyleSheet, Pressable, Linking } from 'react-native'
import Animated, { FadeInRight, FadeOutLeft } from 'react-native-reanimated'
import { useRouter } from 'expo-router'
import { useUnistyles } from 'react-native-unistyles'
import * as Notifications from 'expo-notifications'
import {
  Briefcase,
  ShieldCheck,
  Wallet,
  Download,
  Bell,
  ExternalLink,
} from 'lucide-react-native'
import { spacing, radius } from '@/theme/tokens'
import { ScreenContainer, Text, Button, Spacer, Divider } from '@/components/ui'
import { OnboardingSlide } from '@/components/onboarding/OnboardingSlide'
import { OnboardingDots } from '@/components/onboarding/OnboardingDots'
import { useOnboardingStore } from '@/stores/onboarding.store'
import { APP_INFO } from '@/lib/app-info'

type Phase = 'slides' | 'permission'

const SLIDES = [
  {
    Icon: Briefcase,
    title: 'Get paid for work you do',
    body: 'Find gigs or post work. Payment is guaranteed before anyone starts.',
  },
  {
    Icon: ShieldCheck,
    title: 'How payment works',
    body: "A client pays upfront into escrow; like a trusted lockbox. You deliver, they approve, money goes straight to you.",
  },
  {
    Icon: Wallet,
    title: 'Your wallet, your account',
    body: "Instead of a bank account, Tenda uses a crypto wallet. It's free, instant, and only you control it.",
  },
  {
    Icon: Download,
    title: 'No wallet yet? No problem',
    body: 'Install Phantom or Solflare — both work with Tenda. Takes 2 minutes.',
  },
] as const

export default function OnboardingScreen() {
  const router = useRouter()
  const { theme } = useUnistyles()
  const { completeOnboarding } = useOnboardingStore()
  const [phase, setPhase] = useState<Phase>('slides')
  const [slideIndex, setSlideIndex] = useState(0)
  const [tosAccepted, setTosAccepted] = useState(false)
  const [isRequesting, setIsRequesting] = useState(false)

  const isLastSlide = slideIndex === SLIDES.length - 1

  async function handleFinish() {
    await completeOnboarding()
    router.replace('/(auth)/connect-wallet')
  }

  async function handleSkip() {
    await handleFinish()
  }

  function handleNext() {
    if (isLastSlide) {
      setPhase('permission')
    } else {
      setSlideIndex((i) => i + 1)
    }
  }

  async function handleAllowNotifications() {
    setIsRequesting(true)
    try {
      await Notifications.requestPermissionsAsync()
    } finally {
      setIsRequesting(false)
      await handleFinish()
    }
  }

  if (phase === 'permission') {
    return (
      <ScreenContainer scroll={false} padding={false} edges={['top', 'left', 'right', 'bottom']}>
        <View style={s.permission}>
          <Spacer flex={1} />
          <View style={[s.permissionIcon, { backgroundColor: theme.colors.primaryTint }]}>
            <Bell size={36} color={theme.colors.primary} />
          </View>
          <Spacer size={spacing.md} />
          <Text variant="heading" align="center">Stay in the loop</Text>
          <Spacer size={spacing.sm} />
          <Text variant="body" align="center" color={theme.colors.textSub}>
            Get notified when someone accepts your gig, submits work, or when your payment is released.
          </Text>
          <Spacer flex={2} />
          <Button
            variant="primary"
            size="lg"
            fullWidth
            loading={isRequesting}
            onPress={handleAllowNotifications}
          >
            Allow notifications
          </Button>
          <Spacer size={spacing.md} />
          <Pressable onPress={handleFinish} style={s.skipBtn}>
            <Text variant="caption" color={theme.colors.textFaint} align="center">
              Not now
            </Text>
          </Pressable>
          <Spacer size={spacing.md} />
        </View>
      </ScreenContainer>
    )
  }

  const currentSlide = SLIDES[slideIndex]

  return (
    <ScreenContainer scroll={false} padding={false} edges={['top', 'left', 'right', 'bottom']}>
      <View style={s.screen}>
        {/* Skip */}
        <View style={s.topBar}>
          <Pressable onPress={handleSkip} style={s.skipBtn}>
            <Text variant="caption" color={theme.colors.textSub}>Skip</Text>
          </Pressable>
        </View>

        {/* Slide */}
        <Animated.View
          key={slideIndex}
          entering={FadeInRight.duration(280)}
          exiting={FadeOutLeft.duration(180)}
          style={s.slideWrapper}
        >
        <OnboardingSlide
          Icon={currentSlide.Icon}
          title={currentSlide.title}
          body={currentSlide.body}
        >
          {isLastSlide && (
            <View style={s.walletSection}>
              {/* Wallet options */}
              <View style={[s.walletCard, { borderColor: theme.colors.border, backgroundColor: theme.colors.surface }]}>
                <View style={s.walletRow}>
                  <View style={s.walletInfo}>
                    <Text variant="label" weight="semibold">Phantom</Text>
                    <Text variant="caption" color={theme.colors.textSub}>Recommended — returns automatically</Text>
                  </View>
                  <Pressable
                    onPress={() => Linking.openURL(APP_INFO.wallets.phantom.playStore)}
                    style={[s.installBtn, { backgroundColor: theme.colors.primaryTint }]}
                  >
                    <ExternalLink size={14} color={theme.colors.primary} />
                    <Text size={12} weight="semibold" color={theme.colors.primary}>Install</Text>
                  </Pressable>
                </View>
                <Divider spacing={0} />
                <View style={s.walletRow}>
                  <View style={s.walletInfo}>
                    <Text variant="label" weight="semibold">Solflare</Text>
                    <Text variant="caption" color={theme.colors.textSub}>Back up seed phrase first, press ← after approving</Text>
                  </View>
                  <Pressable
                    onPress={() => Linking.openURL(APP_INFO.wallets.solflare.playStore)}
                    style={[s.installBtn, { backgroundColor: theme.colors.primaryTint }]}
                  >
                    <ExternalLink size={14} color={theme.colors.primary} />
                    <Text size={12} weight="semibold" color={theme.colors.primary}>Install</Text>
                  </Pressable>
                </View>
              </View>

              {/* ToS */}
              <Spacer size={spacing.md} />
              <Pressable onPress={() => setTosAccepted((v) => !v)} style={s.tosRow}>
                <View style={[
                  s.checkbox,
                  {
                    borderColor: tosAccepted ? theme.colors.primary : theme.colors.border,
                    backgroundColor: tosAccepted ? theme.colors.primary : 'transparent',
                  },
                ]}>
                  {tosAccepted && <Text size={10} weight="bold" color={theme.colors.onPrimary}>✓</Text>}
                </View>
                <Text variant="caption" color={theme.colors.textSub} style={s.tosText}>
                  I agree to the{' '}
                  <Text
                    variant="caption"
                    color={theme.colors.textLink}
                    onPress={() => Linking.openURL(APP_INFO.legal.terms)}
                  >
                    Terms of Service
                  </Text>
                  {' '}and{' '}
                  <Text
                    variant="caption"
                    color={theme.colors.textLink}
                    onPress={() => Linking.openURL(APP_INFO.legal.privacy)}
                  >
                    Privacy Policy
                  </Text>
                </Text>
              </Pressable>
            </View>
          )}
        </OnboardingSlide>
        </Animated.View>

        {/* Bottom controls */}
        <View style={s.bottom}>
          <OnboardingDots total={SLIDES.length} current={slideIndex} />
          <Spacer size={spacing.md} />
          <Button
            variant="primary"
            size="lg"
            fullWidth
            disabled={isLastSlide && !tosAccepted}
            onPress={handleNext}
          >
            {isLastSlide ? 'Get Started' : 'Next'}
          </Button>
          <Spacer size={spacing.md} />
        </View>
      </View>
    </ScreenContainer>
  )
}

const s = StyleSheet.create({
  screen: {
    flex: 1,
  },
  slideWrapper: {
    flex: 1,
  },
  topBar: {
    alignItems: 'flex-end',
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
  },
  skipBtn: {
    padding: spacing.xs,
  },
  bottom: {
    paddingHorizontal: spacing.md,
    alignItems: 'center',
  },
  walletSection: {
    width: '100%',
  },
  walletCard: {
    borderWidth: 1,
    borderRadius: radius.lg,
    overflow: 'hidden',
  },
  walletRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    gap: spacing.sm,
  },
  walletInfo: {
    flex: 1,
    gap: 2,
  },
  installBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: radius.md,
    flexShrink: 0,
  },
  tosRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  checkbox: {
    width: 18,
    height: 18,
    borderRadius: 4,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
    flexShrink: 0,
  },
  tosText: {
    flex: 1,
  },
  permission: {
    flex: 1,
    paddingHorizontal: spacing.md,
    alignItems: 'center',
  },
  permissionIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
})
