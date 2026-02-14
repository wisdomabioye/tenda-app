import { useRouter } from 'expo-router'
import { ScreenContainer } from '@/components/ui/ScreenContainer'
import { ErrorState } from '@/components/feedback/ErrorState'

export default function ErrorRoute() {
  const router = useRouter()

  return (
    <ScreenContainer scroll={false} padding={false} edges={['top', 'left', 'right', 'bottom']}>
      <ErrorState
        title="Wallet not found"
        description="No Solana wallet app was detected. Install a wallet (e.g., Phantom or Solflare) and try again."
        ctaLabel="Back to connect"
        onCtaPress={() => router.replace('/(auth)/connect-wallet')}
      />
    </ScreenContainer>
  )
}
