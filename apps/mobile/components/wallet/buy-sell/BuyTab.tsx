import { useState } from 'react'
import { ScrollView, Linking } from 'react-native'
import { useRouter } from 'expo-router'
import { useUnistyles } from 'react-native-unistyles'
import { LAMPORTS_PER_SOL } from '@tenda/shared'
import { Text, Button, showToast } from '@/components/ui'
import { Input } from '@/components/ui/Input'
import { SectionLabel } from '@/components/ui/SectionLabel'
import { api, ApiClientError } from '@/api/client'
import { useFiatQuote } from '@/hooks/useFiatQuote'
import { QuoteSummary, UnavailableNotice, tabBodyStyle } from './shared'

/** Buy (onramp): NGN in → SOL. Degrades to "unavailable" until a provider is live. */
export function BuyTab() {
  const router = useRouter()
  const { theme } = useUnistyles()
  const [amount, setAmount] = useState('')
  const fiatAmount = Number(amount)
  const valid = Number.isFinite(fiatAmount) && fiatAmount > 0
  const { quote, expiresIn, loading, error } = useFiatQuote(valid ? { direction: 'onramp', fiatAmount } : null)
  const [submitting, setSubmitting] = useState(false)

  async function handleConfirm() {
    if (quote === null || submitting) return
    setSubmitting(true)
    try {
      const result = await api.fiat.onramp({ intent_id: quote.intent_id })
      // CO4 p2p match: the quote was a live sell offer, accept it on the
      // exchange surface (on-chain accept + fiat payment flow).
      if ('kind' in result.instruction && result.instruction.kind === 'p2p') {
        showToast('success', 'Matched with a seller, accept the offer to lock the trade')
        router.replace(`/exchange/${result.instruction.offer_id}` as Parameters<typeof router.replace>[0])
        return
      }
      if (result.kyc_url !== null) {
        await Linking.openURL(result.kyc_url)
      } else if ('kind' in result.instruction && result.instruction.kind === 'redirect') {
        await Linking.openURL(result.instruction.url)
      }
      router.replace({ pathname: '/wallet/intents/[id]', params: { id: result.intent_id } })
    } catch (e) {
      showToast('error', e instanceof ApiClientError ? e.message : 'Could not start the purchase')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <ScrollView contentContainerStyle={tabBodyStyle} keyboardShouldPersistTaps="handled">
      <SectionLabel>Amount</SectionLabel>
      <Input label="You pay (NGN)" placeholder="15000" value={amount} onChangeText={setAmount} keyboardType="numeric" />

      {error === 'unavailable' && (
        <UnavailableNotice copy="No sell offer matches this amount right now, try a slightly different amount or check back soon." />
      )}
      {error === 'failed' && (
        <Text size={12.5} color={theme.colors.feedback.danger.base}>
          Could not fetch a quote, please try again.
        </Text>
      )}

      {quote !== null && (
        <>
          <QuoteSummary
            rate={quote.rate}
            fee={quote.fee_amount}
            receiveLine={`~${(Number(quote.asset_amount_raw) / LAMPORTS_PER_SOL).toFixed(4)} SOL`}
            expiresIn={expiresIn}
          />
          <Button
            variant="primary"
            size="lg"
            fullWidth
            loading={submitting}
            disabled={expiresIn <= 0}
            onPress={() => void handleConfirm()}
          >
            Confirm purchase
          </Button>
        </>
      )}
      {loading && quote === null && error === null && (
        <Text size={12.5} color={theme.colors.content.tertiary}>Fetching quote…</Text>
      )}
    </ScrollView>
  )
}
