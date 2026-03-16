import { useState } from 'react'
import { View, StyleSheet } from 'react-native'
import { useUnistyles } from 'react-native-unistyles'
import { spacing } from '@/theme/tokens'
import { Button } from '@/components/ui'
import { PaidProofSheet } from './PaidProofSheet'
import { DisputeSheet } from './DisputeSheet'
import { type PickedFile } from '@/components/form/FilePicker'
import type { ExchangeOfferDetail, SupportedCurrency } from '@tenda/shared'
import type { useExchangeActions } from './useExchangeActions'

type Actions = ReturnType<typeof useExchangeActions>
type Mode = 'paid' | 'dispute' | null

interface Props {
  offer:    ExchangeOfferDetail
  isSeller: boolean
  isBuyer:  boolean
  actions:  Actions
}

export function ExchangeCTABar({ offer, isSeller, isBuyer, actions }: Props) {
  const { theme } = useUnistyles()
  const [mode, setMode]     = useState<Mode>(null)
  const [files, setFiles]   = useState<PickedFile[]>([])
  const [reason, setReason] = useState('')

  const { status } = offer

  function cancelMode() { setMode(null); setFiles([]); setReason('') }

  const inlineContent = (() => {
    if (mode === 'paid') return (
      <PaidProofSheet
        fiatAmount={offer.fiat_amount}
        currency={offer.fiat_currency as SupportedCurrency}
        files={files} onFiles={setFiles}
        loading={actions.busy}
        onSubmit={async () => { if (await actions.markPaid(files)) cancelMode() }}
        onCancel={cancelMode}
      />
    )
    if (mode === 'dispute') return (
      <DisputeSheet
        value={reason} onChange={setReason}
        loading={actions.busy}
        onSubmit={async () => { if (await actions.dispute(reason)) cancelMode() }}
        onCancel={cancelMode}
      />
    )
    return null
  })()

  const loading  = actions.busy || actions.isTxBuilding
  const disabled = actions.txInProgress

  const buttons = (() => {
    if (mode) return null
    if (status === 'draft' && isSeller)
      return (
        <View style={s.row}>
          <Button variant="outline" style={s.flex1} loading={loading} disabled={disabled} onPress={actions.cancel}>Delete</Button>
          <Button variant="primary" style={s.flex2} loading={loading} disabled={disabled} onPress={actions.publishOffer}>Fund &amp; Publish</Button>
        </View>
      )
    if (status === 'open' && isSeller)
      return <Button variant="outline" fullWidth loading={loading} disabled={disabled} onPress={actions.cancel}>Cancel Offer</Button>
    if (status === 'open' && !isSeller)
      return <Button variant="primary" fullWidth loading={loading} disabled={disabled} onPress={actions.accept}>Accept Offer</Button>
    if (status === 'accepted' && isBuyer)
      return (
        <View style={s.row}>
          <Button variant="outline" style={s.flex1} disabled={disabled} onPress={() => setMode('dispute')}>Dispute</Button>
          <Button variant="primary" style={s.flex2} disabled={disabled} onPress={() => setMode('paid')}>Mark as Paid</Button>
        </View>
      )
    if (status === 'paid' && isSeller)
      return (
        <View style={s.row}>
          <Button variant="outline" style={s.flex1} disabled={disabled} onPress={() => setMode('dispute')}>Dispute</Button>
          <Button variant="primary" style={s.flex2} loading={loading} disabled={disabled} onPress={actions.confirm}>Confirm Payment</Button>
        </View>
      )
    if ((status === 'accepted' && isSeller) || (status === 'paid' && isBuyer))
      return <Button variant="outline" fullWidth disabled={disabled} onPress={() => setMode('dispute')}>Raise Dispute</Button>
    if (status === 'expired' && isSeller)
      return <Button variant="primary" fullWidth loading={loading} disabled={disabled} onPress={actions.refundExpired}>Claim Refund</Button>
    return null
  })()

  if (!buttons && !inlineContent) return null

  return (
    <View style={[s.bar, { borderTopColor: theme.colors.borderFaint, backgroundColor: theme.colors.background }]}>
      {inlineContent}
      {buttons}
    </View>
  )
}

const s = StyleSheet.create({
  bar:   { padding: spacing.md, borderTopWidth: 1 },
  row:   { flexDirection: 'row', gap: spacing.sm },
  flex1: { flex: 1 },
  flex2: { flex: 2 },
})
