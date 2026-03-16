import { useState } from 'react'
import { View, StyleSheet } from 'react-native'
import { useUnistyles } from 'react-native-unistyles'
import { spacing, radius } from '@/theme/tokens'
import { Button, Text, Spacer, Card } from '@/components/ui'
import { Input } from '@/components/ui/Input'
import { FilePicker, type PickedFile } from '@/components/form/FilePicker'
import { StarRating } from '@/components/form/StarRating'
import { PaidProofSheet } from './PaidProofSheet'
import { DisputeSheet } from './DisputeSheet'
import type { ExchangeOfferDetail, SupportedCurrency } from '@tenda/shared'
import type { useExchangeActions } from './useExchangeActions'

type Actions = ReturnType<typeof useExchangeActions>
type Mode = 'paid' | 'dispute' | 'addProof' | 'review' | null
type Score = 1 | 2 | 3 | 4 | 5

interface Props {
  offer:         ExchangeOfferDetail
  isSeller:      boolean
  isBuyer:       boolean
  currentUserId: string
  actions:       Actions
}

export function ExchangeCTABar({ offer, isSeller, isBuyer, currentUserId, actions }: Props) {
  const { theme } = useUnistyles()
  const [mode, setMode]           = useState<Mode>(null)
  const [files, setFiles]         = useState<PickedFile[]>([])
  const [reason, setReason]       = useState('')
  const [reviewScore, setReviewScore]     = useState<Score | null>(null)
  const [reviewComment, setReviewComment] = useState('')

  const { status } = offer

  function cancelMode() {
    setMode(null)
    setFiles([])
    setReason('')
    setReviewScore(null)
    setReviewComment('')
  }

  const hasReviewed = offer.reviews.some((r) => r.reviewer_id === currentUserId)
  const canReview   = (status === 'completed' || status === 'resolved') && (isSeller || isBuyer) && !hasReviewed

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
    if (mode === 'addProof') return (
      <Card variant="outlined" padding={spacing.md} style={s.sheet}>
        <Text weight="semibold">Add More Proof</Text>
        <Text variant="caption" style={{ marginTop: 4 }}>
          Upload additional evidence of payment for the seller.
        </Text>
        <Spacer size={spacing.sm} />
        <FilePicker files={files} onChange={setFiles} accept="any" max={5} />
        <Spacer size={spacing.sm} />
        <View style={s.row}>
          <Button variant="ghost" style={s.flex1} onPress={cancelMode}>Cancel</Button>
          <Button
            variant="primary" style={s.flex2}
            loading={actions.busy} disabled={files.length === 0}
            onPress={async () => { if (await actions.addProofs(files)) cancelMode() }}
          >
            Upload
          </Button>
        </View>
      </Card>
    )
    if (mode === 'review') return (
      <Card variant="outlined" padding={spacing.md} style={s.sheet}>
        <Text weight="semibold">Leave a Review</Text>
        <Spacer size={spacing.sm} />
        <View style={s.starRow}>
          <StarRating value={reviewScore} onChange={(v) => setReviewScore(v as Score)} />
        </View>
        <Spacer size={spacing.sm} />
        <Input
          label="Comment (optional)"
          placeholder="Share your experience..."
          value={reviewComment}
          onChangeText={setReviewComment}
          multiline
          numberOfLines={3}
          style={s.multiline}
        />
        <Spacer size={spacing.sm} />
        <View style={s.row}>
          <Button variant="ghost" style={s.flex1} onPress={cancelMode}>Cancel</Button>
          <Button
            variant="primary" style={s.flex2}
            loading={actions.busy} disabled={!reviewScore}
            onPress={async () => {
              if (!reviewScore) return
              if (await actions.reviewOffer({ score: reviewScore, comment: reviewComment.trim() || undefined })) cancelMode()
            }}
          >
            Submit Review
          </Button>
        </View>
      </Card>
    )
    return null
  })()

  const buttons = (() => {
    if (mode) return null

    if (actions.txInProgress) return (
      <View style={[s.notice, { backgroundColor: theme.colors.warningTint }]}>
        <Text variant="caption" color={theme.colors.warning} weight="semibold" align="center">
          Transaction in progress — please wait…
        </Text>
      </View>
    )

    if (status === 'draft' && isSeller)
      return (
        <View style={s.row}>
          <Button variant="outline" style={s.flex1} onPress={actions.cancel}>Delete</Button>
          <Button variant="primary" style={s.flex2} onPress={actions.publishOffer}>Fund &amp; Publish</Button>
        </View>
      )
    if (status === 'open' && isSeller)
      return <Button variant="outline" fullWidth onPress={actions.cancel}>Cancel Offer</Button>
    if (status === 'open' && !isSeller)
      return <Button variant="primary" fullWidth onPress={actions.accept}>Accept Offer</Button>
    if (status === 'accepted' && isBuyer)
      return (
        <View style={s.row}>
          <Button variant="outline" style={s.flex1} onPress={() => setMode('dispute')}>Dispute</Button>
          <Button variant="primary" style={s.flex2} onPress={() => setMode('paid')}>Mark as Paid</Button>
        </View>
      )
    if (status === 'paid' && isSeller)
      return (
        <View style={s.row}>
          <Button variant="outline" style={s.flex1} onPress={() => setMode('dispute')}>Dispute</Button>
          <Button variant="primary" style={s.flex2} onPress={actions.confirm}>Confirm Payment</Button>
        </View>
      )
    if (status === 'paid' && isBuyer)
      return (
        <View style={s.row}>
          <Button variant="outline" style={s.flex1} onPress={() => setMode('addProof')}>Add Proof</Button>
          <Button variant="outline" style={s.flex1} onPress={() => setMode('dispute')}>Dispute</Button>
        </View>
      )
    if (status === 'accepted' && isSeller)
      return <Button variant="outline" fullWidth onPress={() => setMode('dispute')}>Raise Dispute</Button>
    if (status === 'expired' && isSeller)
      return <Button variant="primary" fullWidth onPress={actions.refundExpired}>Claim Refund</Button>
    if (canReview)
      return <Button variant="outline" fullWidth onPress={() => setMode('review')}>Leave Review</Button>
    if (status === 'disputed')
      return (
        <View style={[s.notice, { backgroundColor: theme.colors.warningTint }]}>
          <Text variant="caption" color={theme.colors.warning} weight="semibold" align="center">
            Under review by admin
          </Text>
        </View>
      )
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
  bar:      { padding: spacing.md, borderTopWidth: 1 },
  row:      { flexDirection: 'row', gap: spacing.sm },
  flex1:    { flex: 1 },
  flex2:    { flex: 2 },
  notice:   { padding: spacing.md, borderRadius: radius.md },
  sheet:    { marginBottom: spacing.sm },
  starRow:  { alignItems: 'center' },
  multiline: { minHeight: 72, textAlignVertical: 'top' },
})
