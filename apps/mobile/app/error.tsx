import { useRouter } from 'expo-router'
import { ScreenContainer } from '@/components/ui/ScreenContainer'
import { ErrorState } from '@/components/feedback/ErrorState'

export default function ErrorRoute() {
  const router = useRouter()

  return (
    <ScreenContainer scroll={false} padding={false} edges={['top', 'left', 'right', 'bottom']}>
      <ErrorState
        title="Unexpected error"
        description="Something went wrong on our end. Please try connecting again."
        ctaLabel="Back to connect"
        onCtaPress={() => router.replace('/(auth)/connect-wallet')}
      />
    </ScreenContainer>
  )
}
