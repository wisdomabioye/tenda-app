/**
 * Hand-create a P2P sell offer (kind='exchange' escrow). Mirrors the gig
 * create chain:
 *   1) POST /v1/escrows → draft + unsigned create tx
 *   2) POST /v1/exchange → attach offer terms (a failure discards the draft)
 *   3) wallet signs + broadcasts + client-pings, the offer goes live
 *      (draft → open) when the verify pipeline confirms.
 * Multi-asset: the asset/chain come from the picker; the fiat currency is the
 * seller's home-country payout currency.
 */
import { useMemo, useState } from 'react'
import { ScrollView, StyleSheet, View } from 'react-native'
import { useRouter } from 'expo-router'
import { useUnistyles } from 'react-native-unistyles'
import {
  DEFAULT_ACCEPT_WINDOW_SECONDS,
  EXCHANGE_PAYMENT_WINDOW_DEFAULT_SECONDS,
  parseUnits,
  formatAssetAmount,
  payoutCurrencyForCountry,
  CURRENCY_META,
} from '@tenda/shared'
import { ScreenContainer, Text, Spacer, Header, Button, Input, showToast } from '@/components/ui'
import { SectionLabel } from '@/components/ui/SectionLabel'
import { api, ApiClientError } from '@/api/client'
import { useAuthStore } from '@/stores/auth.store'
import { useExchangeAssetOptions } from '@/hooks/useExchangeAssetOptions'
import { AssetChainPicker, optionKey } from '@/components/exchange/AssetChainPicker'
import { signSendAndReport } from '@/wallet/dispatch'
import {
  classifyTransactionGateError,
  TRANSACTION_GATE_MESSAGE,
  transactionGateRoute,
} from '@/lib/transaction-gate'
import { spacing } from '@/theme/tokens'

export default function CreateOfferScreen() {
  const router = useRouter()
  const { theme } = useUnistyles()
  const country = useAuthStore((s) => s.user?.country ?? null)

  const options = useExchangeAssetOptions()
  const [pickedKey, setPickedKey] = useState<string | null>(null)
  const option = useMemo(
    () => options.find((o) => optionKey(o) === pickedKey) ?? options[0] ?? null,
    [options, pickedKey],
  )

  const currency = payoutCurrencyForCountry(country)
  const currencySymbol = CURRENCY_META[currency].symbol

  const [amount, setAmount] = useState('')
  const [rate, setRate] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const rateNum = Number(rate)
  const amountRaw = option !== null ? parseUnits(amount, option.decimals) : null
  const valid = option !== null && amountRaw !== null && amountRaw !== '0' && Number.isFinite(rateNum) && rateNum > 0
  const fiatTotal = valid ? Math.floor(Number(amount) * rateNum * 100) / 100 : 0

  async function handleSubmit() {
    if (!valid || option === null || amountRaw === null || submitting) return
    const accept_deadline_unix = Math.floor(Date.now() / 1000) + DEFAULT_ACCEPT_WINDOW_SECONDS

    setSubmitting(true)
    let escrow_id: string | null = null
    try {
      const created = await api.escrows.create({
        kind: 'exchange',
        chain_id: option.chainId,
        asset: option.assetId,
        amount_raw: amountRaw,
        accept_deadline_unix,
        completion_duration_seconds: EXCHANGE_PAYMENT_WINDOW_DEFAULT_SECONDS,
      })
      escrow_id = created.escrow_id

      try {
        await api.exchange.create({
          escrow_id: created.escrow_id,
          fiat_amount: fiatTotal,
          fiat_currency: currency,
          rate: rateNum,
          payment_window_seconds: EXCHANGE_PAYMENT_WINDOW_DEFAULT_SECONDS,
        })
      } catch (e) {
        // Validation failure: discard the orphan draft before surfacing.
        await api.escrows.delete({ id: created.escrow_id }).catch(() => {})
        escrow_id = null
        throw e
      }

      await signSendAndReport({
        unsigned: created.unsigned,
        action: 'create',
        chain_id: option.chainId,
        escrow_id: created.escrow_id,
      })

      showToast('success', 'Offer submitted! It hits the order book once the escrow confirms.')
      router.replace(`/exchange/${created.escrow_id}` as Parameters<typeof router.replace>[0])
    } catch (e) {
      // 9D first-transaction gate: route to link-wallet / verify-contact. It
      // surfaces from escrows.create() before escrow_id is set.
      const gate = classifyTransactionGateError(e)
      if (gate !== null) {
        showToast('error', TRANSACTION_GATE_MESSAGE[gate])
        router.push(transactionGateRoute(gate))
      } else if (escrow_id !== null) {
        // Terms saved but signing failed/declined, the draft survives.
        showToast('info', e instanceof Error ? e.message : 'Signing incomplete, draft saved')
        router.replace(`/exchange/${escrow_id}` as Parameters<typeof router.replace>[0])
      } else {
        showToast('error', e instanceof ApiClientError ? e.message : 'Failed to create the offer')
      }
    } finally {
      setSubmitting(false)
    }
  }

  const symbol = option?.symbol ?? ''
  return (
    <ScreenContainer scroll={false} padding={false} edges={['left', 'right']}>
      <Header title="Post a sell offer" showBack />
      <ScrollView contentContainerStyle={s.body} keyboardShouldPersistTaps="handled">
        <SectionLabel>You sell</SectionLabel>
        <AssetChainPicker
          options={options}
          selectedKey={option !== null ? optionKey(option) : ''}
          onSelect={(o) => setPickedKey(optionKey(o))}
        />
        <Input
          label={`Amount${symbol !== '' ? ` (${symbol})` : ''}`}
          placeholder="2.5"
          value={amount}
          onChangeText={setAmount}
          keyboardType="numeric"
        />
        {options.length === 0 && (
          <Text variant="caption" color={theme.colors.content.tertiary}>
            Connect a wallet to post an offer.
          </Text>
        )}

        <SectionLabel>Your rate</SectionLabel>
        <Input
          label={`${currency} per ${symbol || 'unit'}`}
          placeholder="150000"
          value={rate}
          onChangeText={setRate}
          keyboardType="numeric"
        />

        {valid && (
          <View style={[s.summary, { backgroundColor: theme.colors.surface.inset }]}>
            <Text variant="caption" color={theme.colors.content.secondary}>
              The buyer pays you {currencySymbol}{fiatTotal.toLocaleString('en-US')} for{' '}
              {formatAssetAmount(amountRaw ?? '0', option?.assetId ?? '')}. They get 24 hours to pay
              after accepting; the escrow releases when you confirm receipt.
            </Text>
          </View>
        )}

        <Spacer size={spacing.lg} />
        <Button
          variant="primary"
          size="lg"
          fullWidth
          loading={submitting}
          disabled={!valid}
          onPress={() => void handleSubmit()}
        >
          Post offer
        </Button>
      </ScrollView>
    </ScreenContainer>
  )
}

const s = StyleSheet.create({
  body: {
    padding: spacing.md,
    gap: spacing.sm,
  },
  summary: {
    borderRadius: 12,
    padding: spacing.md,
  },
})
