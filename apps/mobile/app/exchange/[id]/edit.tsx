import { useState, useCallback } from 'react'
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router'
import { ScreenContainer, Header } from '@/components/ui'
import { ExchangeOfferForm } from '@/components/exchange/create'
import { LoadingScreen } from '@/components/feedback/LoadingScreen'
import { ErrorState } from '@/components/feedback/ErrorState'
import type { ExchangeOfferFormValues } from '@/components/exchange/create'
import type { ExchangeOfferDetail, SupportedCurrency } from '@tenda/shared'
import { api } from '@/api/client'

const LAMPORTS_PER_SOL = 1_000_000_000

function offerToFormValues(offer: ExchangeOfferDetail): ExchangeOfferFormValues {
  return {
    solInput:         (Number(offer.lamports_amount) / LAMPORTS_PER_SOL).toString(),
    fiatInput:        offer.fiat_amount.toString(),
    currency:         offer.fiat_currency as SupportedCurrency,
    rateInput:        offer.rate.toString(),
    windowSeconds:    offer.payment_window_seconds,
    hasDeadline:      offer.accept_deadline != null,
    deadlineInput:    offer.accept_deadline ? new Date(offer.accept_deadline).toISOString() : '',
    selectedAccounts: offer.payment_accounts ?? [],
    newMethods:       [],
  }
}

export default function EditExchangeOfferScreen() {
  const { id }  = useLocalSearchParams<{ id: string }>()
  const router  = useRouter()

  const [offer, setOffer]   = useState<ExchangeOfferDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]   = useState<string | null>(null)

  useFocusEffect(useCallback(() => {
    let active = true
    setLoading(true)
    api.exchange.get({ id })
      .then((o) => { if (active) setOffer(o) })
      .catch((e) => { if (active) setError(e instanceof Error ? e.message : 'Failed to load offer') })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [id]))

  if (loading) return <LoadingScreen />
  if (error || !offer) return (
    <ErrorState
      title="Could not load offer"
      description={error ?? 'Offer not found'}
      ctaLabel="Go back"
      onCtaPress={() => router.back()}
    />
  )

  return (
    <ScreenContainer scroll={false} padding={false} edges={['left', 'right', 'bottom']}>
      <Header title="Edit offer" showBack />
      <ExchangeOfferForm
        offerId={id}
        initialValues={offerToFormValues(offer)}
        submitLabel="Save Changes"
        onSuccess={() => router.back()}
      />
    </ScreenContainer>
  )
}
