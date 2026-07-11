import { useMemo, useState } from 'react'
import { ScrollView } from 'react-native'
import { useRouter } from 'expo-router'
import { useUnistyles } from 'react-native-unistyles'
import { parseUnits, payoutCurrencyForCountry, CURRENCY_META, P2P_PROVIDER_ID } from '@tenda/shared'
import { Text, Button, showToast } from '@/components/ui'
import { Input } from '@/components/ui/Input'
import { SectionLabel } from '@/components/ui/SectionLabel'
import { api, ApiClientError } from '@/api/client'
import { useFiatQuote } from '@/hooks/useFiatQuote'
import { useExchangeAssetOptions } from '@/hooks/useExchangeAssetOptions'
import { usePayoutAccounts } from '@/hooks/usePayoutAccounts'
import { AssetChainPicker, optionKey } from '@/components/exchange/AssetChainPicker'
import { PayoutAccountSelect } from '@/components/payout'
import { FeeSummary } from '@/components/shared/FeeSummary'
import { QuoteSummary, UnavailableNotice, tabBodyStyle } from './shared'

/** Sell (offramp): crypto out → fiat to a saved payout account. Multi-asset. */
export function SellTab() {
  const router = useRouter()
  const { theme } = useUnistyles()

  const options = useExchangeAssetOptions()
  const [pickedKey, setPickedKey] = useState<string | null>(null)
  const option = useMemo(
    () => options.find((o) => optionKey(o) === pickedKey) ?? options[0] ?? null,
    [options, pickedKey],
  )

  const [amount, setAmount] = useState('')
  const amountRaw = option !== null ? parseUnits(amount, option.decimals) : null
  const amountValid = amountRaw !== null && amountRaw !== '0'

  // Focus-refreshing loader: a payout account added on the bank-accounts screen
  // shows up the moment we return here (fixes the stale list).
  const { accounts, selectedId, setSelectedId, selected: account, reload } = usePayoutAccounts()
  const [submitting, setSubmitting] = useState(false)

  const currency = payoutCurrencyForCountry(account?.country ?? null)
  const currencySymbol = CURRENCY_META[currency].symbol

  const { quote, expiresIn, loading, error } = useFiatQuote(
    option !== null && amountValid && account !== null
      ? {
          direction: 'offramp',
          asset: option.assetId,
          chainId: option.chainId,
          walletAddress: option.walletAddress,
          fiatCurrency: currency,
          assetAmountRaw: amountRaw ?? undefined,
        }
      : null,
  )

  async function handleConfirm() {
    if (option === null || account === null || amountRaw === null || submitting) return
    // The quote is advisory in the UI, but a FRESH one is required to submit
    // (it carries the intent the offramp initiates against).
    if (quote === null || expiresIn <= 0) {
      showToast('info', 'Fetching the latest price, try again in a moment')
      return
    }
    setSubmitting(true)
    try {
      const result = await api.fiat.offramp({ intent_id: quote.intent_id, bank_account_id: account.id })
      const inst = result.instruction
      if ('kind' in inst && inst.kind === 'p2p') {
        showToast('success', 'Offer created, publish it to match with a buyer')
        router.replace(`/exchange/${inst.offer_id}` as Parameters<typeof router.replace>[0])
        return
      }
      router.replace({ pathname: '/wallet/intents/[id]', params: { id: result.intent_id } })
    } catch (e) {
      showToast('error', e instanceof ApiClientError ? e.message : 'Could not start the cash-out')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <ScrollView contentContainerStyle={tabBodyStyle} keyboardShouldPersistTaps="handled">
      {/* Asset first — you pick WHAT you're selling before HOW MUCH. */}
      <SectionLabel>You sell</SectionLabel>
      <AssetChainPicker
        options={options}
        selectedKey={option !== null ? optionKey(option) : ''}
        onSelect={(o) => setPickedKey(optionKey(o))}
      />
      {options.length === 0 && (
        <Text size={12.5} color={theme.colors.content.tertiary}>
          Connect a wallet to sell crypto.
        </Text>
      )}

      <SectionLabel>Amount</SectionLabel>
      <Input
        label={`Amount${option !== null ? ` (${option.symbol})` : ''}`}
        placeholder="2.5"
        value={amount}
        onChangeText={setAmount}
        keyboardType="numeric"
      />

      <SectionLabel>Payout account</SectionLabel>
      <PayoutAccountSelect
        accounts={accounts}
        selectedId={selectedId}
        selected={account}
        onSelect={setSelectedId}
        reload={reload}
      />

      {error === 'unavailable' && (
        <UnavailableNotice copy="No cash-out route is available for this amount right now, please try again later." />
      )}
      {error === 'failed' && (
        <Text size={12.5} color={theme.colors.feedback.danger.base}>Could not fetch a quote, please try again.</Text>
      )}

      {/* CTA appears as soon as amount + account are valid — the quote is
          advisory and no longer gates the button (fixes the missing CTA). */}
      {amountValid && account !== null && error !== 'unavailable' && (
        <>
          {quote !== null && (
            <QuoteSummary
              rate={quote.rate}
              fee={quote.fee_amount}
              fiatAmount={quote.fiat_amount}
              currencySymbol={currencySymbol}
              assetSymbol={option?.symbol ?? ''}
              expiresIn={expiresIn}
            />
          )}
          {quote === null && loading && (
            <Text size={12.5} color={theme.colors.content.tertiary}>Fetching price…</Text>
          )}
          {/* P2P cash-out is a Tenda escrow — the platform fee (borne by the
              buyer's crypto) is disclosed here so the quote never reads as
              entirely fee-free. Not shown for licensed-provider routes, which
              carry no escrow fee. */}
          {quote?.provider === P2P_PROVIDER_ID && option !== null && amountRaw !== null && (
            <FeeSummary variant="exchange" asset={option.assetId} principalRaw={amountRaw} />
          )}
          <Button variant="primary" size="lg" fullWidth loading={submitting} onPress={() => void handleConfirm()}>
            Confirm cash-out
          </Button>
        </>
      )}
    </ScrollView>
  )
}
