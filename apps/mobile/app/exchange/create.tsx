/**
 * CO4 advanced-mode offer creation: hand-create a sell offer
 * (kind='exchange' escrow). Mirrors the gig create chain:
 *   1) POST /v1/escrows → draft + unsigned create tx
 *   2) POST /v1/exchange → attach offer terms (a failure discards the draft)
 *   3) wallet signs + broadcasts + client-pings — the offer goes live
 *      (draft → open) when the verify pipeline confirms.
 */
import { useMemo, useState } from 'react'
import { ScrollView, StyleSheet, View } from 'react-native'
import { useRouter } from 'expo-router'
import { useUnistyles } from 'react-native-unistyles'
import {
  DEFAULT_ACCEPT_WINDOW_SECONDS,
  EXCHANGE_PAYMENT_WINDOW_DEFAULT_SECONDS,
  LAMPORTS_PER_SOL,
  solanaChainId,
  solanaNativeAssetId,
  formatAssetAmount,
} from '@tenda/shared'
import { ScreenContainer, Text, Spacer, Header, Button, Input, showToast } from '@/components/ui'
import { SectionLabel } from '@/components/ui/SectionLabel'
import { api, ApiClientError } from '@/api/client'
import { useExchangeRateStore } from '@/stores/exchange-rate.store'
import { APP_IDENTITY } from '@/wallet'
import { signSendAndReport } from '@/wallet/dispatch'
import { spacing } from '@/theme/tokens'

/** Float→raw stays exact below this (well under 2^53 lamports). */
const MAX_OFFER_SOL = 1_000_000

export default function CreateOfferScreen() {
  const router = useRouter()
  const { theme } = useUnistyles()
  const rates = useExchangeRateStore((s) => s.rates)

  const [amount, setAmount] = useState('')
  const [rate, setRate] = useState(() => (rates?.NGN !== undefined ? String(Math.round(rates.NGN)) : ''))
  const [submitting, setSubmitting] = useState(false)

  const amountSol = Number(amount)
  const rateNum = Number(rate)
  const valid =
    Number.isFinite(amountSol) &&
    amountSol > 0 &&
    amountSol <= MAX_OFFER_SOL &&
    Number.isFinite(rateNum) &&
    rateNum > 0
  const fiatTotal = valid ? Math.floor(amountSol * rateNum * 100) / 100 : 0
  const amountRaw = useMemo(
    () => (valid ? String(Math.round(amountSol * LAMPORTS_PER_SOL)) : '0'),
    [valid, amountSol],
  )

  async function handleSubmit() {
    if (!valid || submitting) return
    const chain_id = solanaChainId(APP_IDENTITY.network)
    const asset = solanaNativeAssetId(APP_IDENTITY.network)
    const accept_deadline_unix = Math.floor(Date.now() / 1000) + DEFAULT_ACCEPT_WINDOW_SECONDS

    setSubmitting(true)
    let escrow_id: string | null = null
    try {
      const created = await api.escrows.create({
        kind: 'exchange',
        chain_id,
        asset,
        amount_raw: amountRaw,
        accept_deadline_unix,
        completion_duration_seconds: EXCHANGE_PAYMENT_WINDOW_DEFAULT_SECONDS,
      })
      escrow_id = created.escrow_id

      try {
        await api.exchange.create({
          escrow_id: created.escrow_id,
          fiat_amount: fiatTotal,
          fiat_currency: 'NGN',
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
        chain_id,
        escrow_id: created.escrow_id,
      })

      showToast('success', 'Offer submitted! It hits the order book once the escrow confirms.')
      router.replace(`/exchange/${created.escrow_id}` as Parameters<typeof router.replace>[0])
    } catch (e) {
      if (escrow_id !== null) {
        // Terms saved but signing failed/declined — the draft survives.
        showToast('info', e instanceof Error ? e.message : 'Signing incomplete — draft saved')
        router.replace(`/exchange/${escrow_id}` as Parameters<typeof router.replace>[0])
      } else {
        showToast('error', e instanceof ApiClientError ? e.message : 'Failed to create the offer')
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <ScreenContainer scroll={false} padding={false} edges={['left', 'right']}>
      <Header title="Post a sell offer" showBack />
      <ScrollView contentContainerStyle={s.body} keyboardShouldPersistTaps="handled">
        <SectionLabel>You sell</SectionLabel>
        <Input
          label="Amount (SOL)"
          placeholder="2.5"
          value={amount}
          onChangeText={setAmount}
          keyboardType="numeric"
        />

        <SectionLabel>Your rate</SectionLabel>
        <Input
          label="NGN per SOL"
          placeholder={rates?.NGN !== undefined ? String(Math.round(rates.NGN)) : '150000'}
          value={rate}
          onChangeText={setRate}
          keyboardType="numeric"
        />

        {valid && (
          <View style={[s.summary, { backgroundColor: theme.colors.surface.inset }]}>
            <Text variant="caption" color={theme.colors.content.secondary}>
              The buyer pays you {fiatTotal.toLocaleString('en-US')} NGN for{' '}
              {formatAssetAmount(amountRaw, solanaNativeAssetId(APP_IDENTITY.network))}. They get
              24 hours to pay after accepting; the escrow releases when you confirm receipt.
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
