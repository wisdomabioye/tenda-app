import { useRouter } from 'expo-router'
import { ScreenContainer, Header } from '@/components/ui'
import { SellTab } from '@/components/wallet/buy-sell/SellTab'

/**
 * Sell / cash-out screen (offramp + P2P sell-offer posting). Buy (onramp) is
 * retired until a licensed onramp provider is live (#61); until then the P2P
 * market on the Trade tab is the buy surface. Route path stays `/wallet/buy-sell`
 * so existing links/registrations keep working.
 */
export default function SellScreen() {
  const router = useRouter()
  return (
    <ScreenContainer scroll={false} padding={false} edges={['left', 'right', 'bottom']}>
      <Header title="Sell / Cash out" showBack onBackPress={() => router.back()} />
      <SellTab />
    </ScreenContainer>
  )
}
