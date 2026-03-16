import { useRouter } from 'expo-router'
import { ScreenContainer, Header } from '@/components/ui'
import { ExchangeOfferForm } from '@/components/exchange/create'

export default function CreateExchangeOfferScreen() {
  const router = useRouter()

  return (
    <ScreenContainer scroll={false} padding={false} edges={['left', 'right']}>
      <Header title="Sell SOL" showBack />
      <ExchangeOfferForm
        submitLabel="Save Draft"
        onSuccess={(id) => router.replace(`/exchange/${id}` as never)}
      />
    </ScreenContainer>
  )
}
