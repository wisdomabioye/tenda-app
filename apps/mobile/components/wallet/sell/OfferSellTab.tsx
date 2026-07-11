import { useState } from 'react'
import { ScrollView, StyleSheet, View } from 'react-native'
import { useUnistyles } from 'react-native-unistyles'
import {
  parseUnits,
  formatAssetAmount,
  payoutCurrencyForCountry,
  CURRENCY_META,
  DEFAULT_ACCEPT_WINDOW_SECONDS,
  EXCHANGE_PAYMENT_WINDOW_DEFAULT_SECONDS,
} from '@tenda/shared'
import { Text, Button, Spacer } from '@/components/ui'
import { Input } from '@/components/ui/Input'
import { SectionLabel } from '@/components/ui/SectionLabel'
import { FeeSummary } from '@/components/shared/FeeSummary'
import { usePayoutAccounts } from '@/hooks/usePayoutAccounts'
import { spacing } from '@/theme/tokens'
import { useAssetSelection } from './useAssetSelection'
import { useOfferSell } from './useOfferSell'
import { SellAssetAmount } from './SellAssetAmount'
import { SellPayoutSection } from './SellPayoutSection'
import { OfferDeadlines } from './OfferDeadlines'
import { tabBodyStyle } from './shared'

const SECONDS_PER_HOUR = 60 * 60
// Must resolve to an hours value present in ACCEPT_DEADLINE_OPTIONS, else the
// tab opens with no accept chip selected (7d/168h is currently in the set).
const DEFAULT_ACCEPT_HOURS = DEFAULT_ACCEPT_WINDOW_SECONDS / SECONDS_PER_HOUR

/** Create offer: crypto out → fiat at YOUR rate (a P2P sell offer on the book). */
export function OfferSellTab() {
  const { theme } = useUnistyles()
  const selection = useAssetSelection()
  const payout = usePayoutAccounts()

  const [amount, setAmount] = useState('')
  const [rate, setRate] = useState('')
  const [acceptHours, setAcceptHours] = useState(DEFAULT_ACCEPT_HOURS)
  const [paymentWindowSeconds, setPaymentWindowSeconds] = useState(EXCHANGE_PAYMENT_WINDOW_DEFAULT_SECONDS)

  const { submitting, submit } = useOfferSell()

  const option = selection.option
  const account = payout.selected
  const currency = payoutCurrencyForCountry(account?.country ?? null)
  const currencySymbol = CURRENCY_META[currency].symbol

  const rateNum = Number(rate)
  const amountRaw = option !== null ? parseUnits(amount, option.decimals) : null
  const valid =
    option !== null && amountRaw !== null && amountRaw !== '0' &&
    Number.isFinite(rateNum) && rateNum > 0 && account !== null
  const fiatTotal = valid ? Math.floor(Number(amount) * rateNum * 100) / 100 : 0

  function handleSubmit() {
    if (!valid || option === null || amountRaw === null || account === null) return
    void submit({ option, amountRaw, account, fiatTotal, currency, rate: rateNum, acceptHours, paymentWindowSeconds })
  }

  const symbol = option?.symbol ?? ''
  return (
    <ScrollView contentContainerStyle={tabBodyStyle} keyboardShouldPersistTaps="handled">
      <SellAssetAmount
        selection={selection}
        amount={amount}
        onAmountChange={setAmount}
        noWalletMessage="Link a wallet to post an offer."
      />

      {selection.options.length > 0 && (
        <>
          <SectionLabel>Your rate</SectionLabel>
          <Input
            label={`${currency} per ${symbol || 'unit'}`}
            placeholder="150000"
            value={rate}
            onChangeText={setRate}
            keyboardType="numeric"
          />

          <OfferDeadlines
            acceptHours={acceptHours}
            onAcceptChange={setAcceptHours}
            paymentWindowSeconds={paymentWindowSeconds}
            onPaymentWindowChange={setPaymentWindowSeconds}
          />

          <SellPayoutSection payout={payout} />

          {valid && option !== null && amountRaw !== null && (
            <>
              <View style={[s.summary, { backgroundColor: theme.colors.surface.inset }]}>
                <Text variant="caption" color={theme.colors.content.secondary}>
                  The buyer pays you {currencySymbol}{fiatTotal.toLocaleString('en-US')} for{' '}
                  {formatAssetAmount(amountRaw, option.assetId)}. They pay after accepting; the escrow
                  releases when you confirm receipt.
                </Text>
              </View>
              <FeeSummary variant="exchange" asset={option.assetId} principalRaw={amountRaw} />
            </>
          )}

          <Spacer size={spacing.lg} />
          <Button variant="primary" size="lg" fullWidth loading={submitting} disabled={!valid} onPress={handleSubmit}>
            Post offer
          </Button>
        </>
      )}
    </ScrollView>
  )
}

const s = StyleSheet.create({
  summary: { borderRadius: 12, padding: spacing.md },
})
