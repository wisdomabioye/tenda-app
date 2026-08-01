import { View, StyleSheet } from 'react-native'
import { spacing } from '@/theme/tokens'
import { Button } from '@/components/ui/Button'
import {
  canAccept,
  canSubmit,
  canCancel,
  canClaim,
  canDispute,
  canReview,
  canAddProof,
  escrowPartiesOf,
} from '@tenda/shared'
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
  // Read from the offer, never assumed. This used to spread
  // UNRESTRICTED_ACCEPTANCE on the grounds that a P2P offer has no acceptance
  // mode — true of `requires_approval` (server-rejected for kind='exchange'),
  // false of the assignee, which create accepts on either kind. A direct-invite
  // offer therefore showed every stranger an Accept button the server answers
  // with 403. Same builder as the gig CTA, so neither can drift again.
  const parties = escrowPartiesOf(offer)
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
  // Claim is checked BEFORE add-proof: a submitted buyer past the approval
  // deadline satisfies BOTH canClaim and canAddProof, and getting their crypto
  // must win over uploading more evidence (else the claim action is hidden).
  if (canClaim({ ...parties, approval_deadline: offer.approval_deadline }, userId)) {
    return (
      <Button variant="primary" size="xl" fullWidth loading={busy} onPress={() => onTxAction('claim_stalled')}>
        Claim Crypto
      </Button>
    )
  }
  // The buyer (counterparty) keeps adding payment evidence while the seller
  // reviews (submitted) or the mediator does (disputed) — parity with the gig
  // path, where a dropped-off "Add Evidence" affordance during a dispute is
  // exactly the bug this mirrors. canAddProof is counterparty + submitted|disputed.
  if (canAddProof(parties, userId)) {
    // Submitted (not yet disputed): the buyer can escalate to a dispute too —
    // symmetry with the gig worker (GigCTABar pairs "Add More Proof" with
    // "Dispute"). This branch returns before the canDispute check below, so
    // without pairing it here the buyer could never dispute a stalling seller.
    // Once disputed, evidence only (the mediator owns it — no redundant button).
    if (offer.status !== 'disputed' && canDispute(parties, userId)) {
      return (
        <View style={s.row}>
          <Button variant="outline" size="xl" style={s.flex} onPress={() => onSheet('addProof')}>
            Add More Proof
          </Button>
          <Button variant="danger" size="xl" onPress={() => onSheet('dispute')}>
            Dispute
          </Button>
        </View>
      )
    }
    return (
      <Button variant="outline" size="xl" fullWidth onPress={() => onSheet('addProof')}>
        {offer.status === 'disputed' ? 'Add Evidence' : 'Add More Proof'}
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
