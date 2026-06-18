import { useState } from 'react'
import { View, StyleSheet, Pressable } from 'react-native'
import Animated, { FadeInRight, FadeOutLeft } from 'react-native-reanimated'
import { useRouter } from 'expo-router'
import { useUnistyles } from 'react-native-unistyles'
import * as Notifications from 'expo-notifications'
import { Briefcase, ShieldCheck, Wallet, Download } from 'lucide-react-native'
import { spacing } from '@/theme/tokens'
import { ScreenContainer, Text, Button, Spacer } from '@/components/ui'
import { OnboardingSlide } from '@/components/onboarding/OnboardingSlide'
import { OnboardingDots } from '@/components/onboarding/OnboardingDots'
import { WalletInstallSection } from '@/components/onboarding/WalletInstallSection'
import { NotificationPermissionStep } from '@/components/onboarding/NotificationPermissionStep'
import { useOnboardingStore } from '@/stores/onboarding.store'

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

  function handleNext() {
    if (isLastSlide) setPhase('permission')
    else setSlideIndex((i) => i + 1)
  }

  async function handleAllowNotifications() {
    setIsRequesting(true)
    try {
      await Notifications.requestPermissionsAsync()
    } finally {
      // Do NOT reset isRequesting before navigating — resetting state while
      // simultaneously navigating after returning from an Android system dialog
      // causes a view reconciliation race in Fabric (ReactClippingViewManager crash).
      await handleFinish()
    }
  }

  if (phase === 'permission') {
    return (
      <NotificationPermissionStep
        isRequesting={isRequesting}
        onAllow={handleAllowNotifications}
        onSkip={handleFinish}
      />
    )
  }

  const currentSlide = SLIDES[slideIndex]

  return (
    <ScreenContainer scroll={false} padding={false} edges={['left', 'right', 'bottom']}>
      <View style={s.screen}>
        {/* Skip */}
        <View style={s.topBar}>
          <Pressable onPress={handleFinish} style={s.skipBtn}>
            <Text variant="caption" color={theme.colors.content.secondary}>Skip</Text>
          </Pressable>
        </View>

        {/* Slide */}
        <Animated.View
          key={slideIndex}
          entering={FadeInRight.duration(280)}
          exiting={FadeOutLeft.duration(180)}
          style={s.slideWrapper}
        >
          <OnboardingSlide Icon={currentSlide.Icon} title={currentSlide.title} body={currentSlide.body}>
            {isLastSlide && (
              <WalletInstallSection tosAccepted={tosAccepted} onToggleTos={() => setTosAccepted((v) => !v)} />
            )}
          </OnboardingSlide>
        </Animated.View>

        {/* Bottom controls */}
        <View style={s.bottom}>
          <OnboardingDots total={SLIDES.length} current={slideIndex} />
          <Spacer size={spacing.md} />
          <Button variant="primary" size="lg" fullWidth disabled={isLastSlide && !tosAccepted} onPress={handleNext}>
            {isLastSlide ? 'Get Started' : 'Next'}
          </Button>
          <Spacer size={spacing.md} />
        </View>
      </View>
    </ScreenContainer>
  )
}

const s = StyleSheet.create({
  screen: { flex: 1 },
  slideWrapper: { flex: 1 },
  topBar: { alignItems: 'flex-end', paddingHorizontal: spacing.md, paddingTop: spacing.sm },
  skipBtn: { padding: spacing.xs },
  bottom: { paddingHorizontal: spacing.md, alignItems: 'center' },
})
