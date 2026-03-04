import { useRouter } from 'expo-router'
import { spacing } from '@/theme/tokens'
import { BottomSheet, Text, Button, Spacer } from '@/components/ui'
import { useOnboardingStore } from '@/stores/onboarding.store'
import type { NudgeKey } from '@/stores/onboarding.store'

interface NudgeSheetProps {
  visible: boolean
  nudgeKey: NudgeKey
  title: string
  body: string
  guideRoute: string
  onClose: () => void
}

export function NudgeSheet({ visible, nudgeKey, title, body, guideRoute, onClose }: NudgeSheetProps) {
  const router = useRouter()
  const { dismissNudge } = useOnboardingStore()

  async function handleDismiss() {
    await dismissNudge(nudgeKey)
    onClose()
  }

  async function handleShowGuide() {
    await dismissNudge(nudgeKey)
    onClose()
    router.push(guideRoute as any)
  }

  return (
    <BottomSheet visible={visible} onClose={handleDismiss} title={title}>
      <Text variant="body">{body}</Text>
      <Spacer size={spacing.lg} />
      <Button variant="primary" size="lg" fullWidth onPress={handleShowGuide}>
        Show me how
      </Button>
      <Spacer size={spacing.sm} />
      <Button variant="ghost" size="lg" fullWidth onPress={handleDismiss}>
        Got it
      </Button>
    </BottomSheet>
  )
}
