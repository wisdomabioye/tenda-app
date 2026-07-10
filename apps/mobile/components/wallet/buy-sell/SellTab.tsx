import { useCallback, useEffect, useMemo, useState } from 'react'
import { View, ScrollView, Pressable, StyleSheet } from 'react-native'
import { useRouter } from 'expo-router'
import { useUnistyles } from 'react-native-unistyles'
import { Landmark, Smartphone } from 'lucide-react-native'
import { parseUnits, payoutCurrencyForCountry, CURRENCY_META, type BankAccountSummary } from '@tenda/shared'
import { Text, Button, showToast } from '@/components/ui'
import { Input } from '@/components/ui/Input'
import { SectionLabel } from '@/components/ui/SectionLabel'
import { api, ApiClientError } from '@/api/client'
import { useFiatQuote } from '@/hooks/useFiatQuote'
import { useExchangeAssetOptions } from '@/hooks/useExchangeAssetOptions'
import { AssetChainPicker, optionKey } from '@/components/exchange/AssetChainPicker'
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

  const [accounts, setAccounts] = useState<BankAccountSummary[] | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const loadAccounts = useCallback(() => {
    api.fiat
      .bankAccounts()
      .then((rows) => {
        setAccounts(rows)
        setSelectedId((cur) => cur ?? rows.find((r) => r.is_default)?.id ?? rows[0]?.id ?? null)
      })
      .catch(() => setAccounts([]))
  }, [])
  useEffect(() => { loadAccounts() }, [loadAccounts])

  const account = accounts?.find((a) => a.id === selectedId) ?? null
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
      <SectionLabel>Amount</SectionLabel>
      <AssetChainPicker
        options={options}
        selectedKey={option !== null ? optionKey(option) : ''}
        onSelect={(o) => setPickedKey(optionKey(o))}
      />
      <Input
        label={`You sell${option !== null ? ` (${option.symbol})` : ''}`}
        placeholder="2.5"
        value={amount}
        onChangeText={setAmount}
        keyboardType="numeric"
      />
      {options.length === 0 && (
        <Text size={12.5} color={theme.colors.content.tertiary}>
          Connect a wallet to sell crypto.
        </Text>
      )}

      <SectionLabel>Payout account</SectionLabel>
      {accounts !== null && accounts.length === 0 && (
        <Button
          variant="outline"
          size="md"
          fullWidth
          onPress={() => router.push('/settings/bank-accounts' as Parameters<typeof router.push>[0])}
        >
          Add a payout account
        </Button>
      )}
      {accounts?.map((a) => {
        const Icon = a.kind === 'mobile_money' ? Smartphone : Landmark
        return (
          <Pressable
            key={a.id}
            onPress={() => setSelectedId(a.id)}
            style={[
              s.accountRow,
              {
                backgroundColor: theme.colors.surface.card,
                borderColor: selectedId === a.id ? theme.colors.brand.primary : theme.colors.border.default,
              },
            ]}
            accessibilityRole="radio"
            accessibilityState={{ selected: selectedId === a.id }}
          >
            <Icon size={16} color={theme.colors.content.secondary} />
            <View style={s.accountBody}>
              <Text size={13.5} weight="semibold">{a.account_name}</Text>
              <Text size={12} color={theme.colors.content.tertiary}>
                {a.bank_code} · {a.account_number_masked}
              </Text>
            </View>
          </Pressable>
        )
      })}

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
          <Button variant="primary" size="lg" fullWidth loading={submitting} onPress={() => void handleConfirm()}>
            Confirm cash-out
          </Button>
        </>
      )}
    </ScrollView>
  )
}

const s = StyleSheet.create({
  accountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1.5,
    borderRadius: 12,
    padding: 12,
  },
  accountBody: { flex: 1, gap: 2 },
})
