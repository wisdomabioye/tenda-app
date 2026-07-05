import { View, StyleSheet } from 'react-native'
import { spacing } from '@/theme/tokens'
import { Button } from '@/components/ui/Button'
import { canAccept, canSubmit, canCancel, canClaim, canDispute, canReview } from '@tenda/shared'
import type { EscrowTxType, ExchangeDetail } from '@tenda/shared'
import type { ActiveSheet } from '@/components/gig'

interface Props {
  offer: ExchangeDetail
  userId: string
  /** True while a transition is building/confirming (button spinner). */
  busy: boolean
  /** Wallet-opening move → screen shows the shared confirm gate first. */
  onTxAction: (action: EscrowTxType) => void
  onSheet: (sheet: ActiveSheet) => void
}

/**
 * Exchange CTA set over the shared visibility helpers, 'submit' is the
 * buyer's fiat-payment proof ("Mark as Paid"); the seller's approve
 * releases the crypto. Wallet-opening moves route through the confirm gate.
 */
export function ExchangeCTA({ offer, userId, busy, onTxAction, onSheet }: Props) {
  const parties = {
    status: offer.status,
    creator_id: offer.creator.id,
    counterparty_id: offer.counterparty?.id ?? null,
  }
  const isCreator = userId === offer.creator.id

  // Drafts: publish (build-create rebuilds the unsigned tx, covers
  // fiat-offramp drafts that never had one and signing-declined retries)
  // or discard.
  if (offer.status === 'draft' && isCreator) {
    return (
      <View style={s.row}>
        <View style={s.flex}>
          <Button variant="outline" size="xl" fullWidth onPress={() => onSheet('delete')}>
            Delete Draft
          </Button>
        </View>
        <View style={s.flex}>
          <Button variant="primary" size="xl" fullWidth loading={busy} onPress={() => onTxAction('create')}>
            Publish Offer
          </Button>
        </View>
      </View>
    )
  }
  if (canAccept(parties, userId)) {
    return (
      <Button variant="primary" size="xl" fullWidth loading={busy} onPress={() => onTxAction('accept')}>
        Accept Offer
      </Button>
    )
  }
  if (canCancel(parties, userId) && offer.status === 'open') {
    return (
      <Button variant="danger" size="xl" fullWidth loading={busy} onPress={() => onTxAction('cancel')}>
        Cancel Offer
      </Button>
    )
  }
  if (canSubmit(parties, userId)) {
    return (
      <Button variant="primary" size="xl" fullWidth onPress={() => onSheet('proof')}>
        Mark as Paid
      </Button>
    )
  }
  if (offer.status === 'submitted' && isCreator) {
    return (
      <View style={s.row}>
        <Button variant="primary" size="xl" style={s.flex} loading={busy} onPress={() => onTxAction('approve')}>
          Confirm & Release
        </Button>
        <Button variant="danger" size="xl" onPress={() => onSheet('dispute')}>
          Dispute
        </Button>
      </View>
    )
  }
  if (canClaim({ ...parties, approval_deadline: offer.approval_deadline }, userId)) {
    return (
      <Button variant="primary" size="xl" fullWidth loading={busy} onPress={() => onTxAction('claim_stalled')}>
        Claim Crypto
      </Button>
    )
  }
  if (canDispute(parties, userId)) {
    return (
      <Button variant="danger" size="xl" fullWidth onPress={() => onSheet('dispute')}>
        Dispute
      </Button>
    )
  }
  if (canReview(parties, userId) && !offer.reviews.some((r) => r.reviewer_id === userId)) {
    return (
      <Button variant="outline" size="xl" fullWidth onPress={() => onSheet('review')}>
        Leave Review
      </Button>
    )
  }
  return null
}

const s = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  flex: { flex: 1 },
})
