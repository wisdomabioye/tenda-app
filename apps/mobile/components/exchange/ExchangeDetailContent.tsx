import { useState } from 'react'
import { ScrollView, StyleSheet, RefreshControl, View } from 'react-native'
import { useRouter } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { spacing, typography } from '@/theme/tokens'
import { ScreenContainer, Text, Badge, Divider, Spacer, showToast } from '@/components/ui'
import { GigActionSheets, type ActiveSheet } from '@/components/gig'
import { ExchangeStatusBadge, ExchangeTermsCard, ExchangeCTA, PaymentInstructionsCard, shouldShowPaymentInstructions } from '@/components/exchange'
import { DetailChrome, DetailBottomBar, DisputeReasonBlock, ReportContentLink, TxConfirmDialog, TX_PROGRESS_LABEL } from '@/components/escrow'
import { PersonCard, ReviewsSection } from '@/components/shared'
import { TransactionMonitor } from '@/components/feedback'
import { ReportSheet } from '@/components/moderation/ReportSheet'
import { formatFiat } from '@/lib/currency'
import { useEscrowActions, type ProofFile } from '@/hooks/useEscrowActions'
import { useEscrowLiveRefresh } from '@/hooks/useEscrowLiveRefresh'
import { formatAssetAmount, computeRelevantDeadline } from '@tenda/shared'
import type { EscrowTxType, ExchangeDetail, SupportedCurrency } from '@tenda/shared'

const SUCCESS_BY_ACTION: Partial<Record<EscrowTxType, string>> = {
  create: 'Offer published, it goes live once the escrow confirms.',
  accept: 'Offer accepted!',
  submit: 'Payment marked, waiting for the seller to confirm.',
  approve: 'Payment confirmed, crypto released.',
  claim_stalled: 'Payment claimed!',
  cancel: 'Offer cancelled, escrow refunded.',
  refund_expired: 'Refund claimed successfully.',
  dispute: 'Dispute raised. An admin will review shortly.',
}

/**
 * Exchange detail body, read surface over a kind='exchange' escrow. Every
 * transition rides the shared escrow action hook (sign → broadcast →
 * client-ping), the same leg as gigs; CTA logic lives in ExchangeCTA.
 */
export function ExchangeDetailContent({
  offer,
  userId,
  refresh,
}: {
  offer: ExchangeDetail
  userId: string
  refresh: () => Promise<void>
}) {
  const router = useRouter()
  const insets = useSafeAreaInsets()

  const [activeSheet, setActiveSheet] = useState<ActiveSheet | null>(null)
  const [confirmAction, setConfirmAction] = useState<EscrowTxType | null>(null)
  const [reportOpen, setReportOpen] = useState(false)
  const [refreshing, setRefreshing] = useState(false)

  const actions = useEscrowActions({ escrowId: offer.escrow_id, chainId: offer.chain_id })
  const isCreator = userId === offer.creator.id

  // Live-update when the counterparty acts (accept / mark-paid / confirm), not
  // just on focus — the escrow WS channel drives the refetch.
  useEscrowLiveRefresh(offer.escrow_id, refresh)

  // Fire the gated transition the confirm dialog was showing ('create' here is
  // the draft publish — rebuild + sign the create tx), then close it.
  function runConfirmedAction() {
    const action = confirmAction
    setConfirmAction(null)
    switch (action) {
      case 'create': return void actions.publish()
      case 'accept': return void actions.accept()
      case 'cancel': return void actions.cancel()
      case 'approve': return void actions.approve()
      case 'claim_stalled': return void actions.claim()
    }
  }
  const fiat = formatFiat(Number(offer.fiat_amount), offer.fiat_currency as SupportedCurrency)
  const contextTitle = `Trade: ${offer.fiat_amount} ${offer.fiat_currency}`

  async function handleRefresh() {
    setRefreshing(true)
    try {
      await refresh()
    } finally {
      setRefreshing(false)
    }
  }

  function handleTransactionConfirmed() {
    const action = actions.pendingAction
    actions.clearPending()
    if (action !== null) {
      showToast('success', SUCCESS_BY_ACTION[action] ?? 'Transaction confirmed')
    }
    if (action === 'cancel') {
      router.back()
    } else {
      void refresh()
    }
  }

  // Buyer's fiat-payment evidence → off-chain proof rows + on-chain submit.
  async function handleProofsReady(proofs: ProofFile[]): Promise<boolean> {
    return actions.submit(proofs)
  }

  async function handleAddProofsReady(proofs: ProofFile[]): Promise<void> {
    if (await actions.addProofs(proofs)) void refresh()
  }

  async function handleDisputeReady(reason: string): Promise<boolean> {
    return actions.dispute(reason, offer.dispute_bond_raw, offer.asset)
  }

  return (
    <ScreenContainer scroll={false} padding={false} edges={['left', 'right', 'bottom']}>
      <DetailChrome onBack={() => router.back()} />

      <ScrollView
        style={s.flex}
        contentContainerStyle={[s.content, { paddingTop: insets.top + 60 }]}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
      >
        <View style={s.badgeRow}>
          <ExchangeStatusBadge status={offer.status} />
          <Badge variant="accent" label="P2P Trade" />
        </View>

        <Spacer size={spacing.sm} />
        <Text style={s.title}>
          {formatAssetAmount(offer.amount_raw, offer.asset)} → {fiat}
        </Text>
        <Spacer size={spacing.md} />

        <ExchangeTermsCard offer={offer} />

        {/* Accepted buyer's payment context: the seller's account, the exact
            amount, and a reference — the info the old screen never surfaced.
            Hidden once disputed (see shouldShowPaymentInstructions). */}
        {shouldShowPaymentInstructions(offer, userId) && offer.payout_account !== null && (
          <>
            <Spacer size={spacing.md} />
            <PaymentInstructionsCard
              account={offer.payout_account}
              fiatDisplay={fiat}
              reference={offer.escrow_id.slice(0, 8).toUpperCase()}
              status={offer.status}
              deadline={computeRelevantDeadline(offer)}
            />
          </>
        )}

        <Spacer size={spacing.lg} />

        <PersonCard
          label="Seller"
          user={offer.creator}
          currentUserId={userId}
          contextId={offer.escrow_id}
          contextTitle={contextTitle}
          isOffer
          showMessageButton={offer.status !== 'draft'}
        />

        {offer.counterparty && (isCreator || userId === offer.counterparty.id) && (
          <>
            <Spacer size={spacing.md} />
            <PersonCard
              label="Buyer"
              user={offer.counterparty}
              currentUserId={userId}
              contextId={offer.escrow_id}
              contextTitle={contextTitle}
              isOffer
              gradient="brand"
            />
          </>
        )}

        {offer.reviews.length > 0 && (
          <>
            <Divider />
            <ReviewsSection
              reviews={offer.reviews}
              partyAId={offer.creator.id}
              partyA={offer.creator}
              partyALabel="Seller"
              partyB={offer.counterparty}
              partyBLabel="Buyer"
              currentUserId={userId}
              title="Reviews"
            />
          </>
        )}

        {offer.dispute && offer.status === 'disputed' && (
          <>
            <Divider />
            <DisputeReasonBlock
              reason={offer.dispute.reason}
              onOpenThread={
                isCreator || userId === offer.counterparty?.id
                  ? () => router.push(`/dispute/${offer.escrow_id}` as Parameters<typeof router.push>[0])
                  : undefined
              }
            />
          </>
        )}

        {!isCreator && (
          <>
            <Divider />
            <ReportContentLink label="Report this offer" onPress={() => setReportOpen(true)} />
          </>
        )}

        <Spacer size={spacing['2xl']} />
      </ScrollView>

      <DetailBottomBar txInProgress={actions.pendingTxRef !== null}>
        <ExchangeCTA
          offer={offer}
          userId={userId}
          busy={actions.busyAction !== null}
          onTxAction={setConfirmAction}
          onSheet={setActiveSheet}
        />
      </DetailBottomBar>

      <TxConfirmDialog
        action={confirmAction}
        ctx={{ amount: formatAssetAmount(offer.amount_raw, offer.asset), kind: 'exchange' }}
        onConfirm={runConfirmedAction}
        onCancel={() => setConfirmAction(null)}
      />

      <GigActionSheets
        gig={offer}
        activeSheet={activeSheet}
        onClose={() => setActiveSheet(null)}
        onReviewSubmitted={() => void refresh()}
        onProofsReady={handleProofsReady}
        onAddProofsReady={handleAddProofsReady}
        onDisputeReady={handleDisputeReady}
      />

      <TransactionMonitor
        signature={actions.pendingTxRef}
        phase={actions.phase}
        actionLabel={actions.activeAction !== null ? TX_PROGRESS_LABEL[actions.activeAction] : undefined}
        escrowId={offer.escrow_id}
        chainId={offer.chain_id}
        onConfirmed={handleTransactionConfirmed}
        onFailed={(msg) => {
          actions.clearPending()
          showToast('info', msg || 'Transaction pending, will sync when confirmed')
        }}
      />

      <ReportSheet visible={reportOpen} onClose={() => setReportOpen(false)} contentType="escrow" contentId={offer.escrow_id} />
    </ScreenContainer>
  )
}

const s = StyleSheet.create({
  flex: { flex: 1 },
  content: { paddingHorizontal: spacing.md },
  badgeRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  title: {
    fontFamily: typography.fonts.mono,
    fontSize: 22,
    lineHeight: 28,
    fontWeight: '700',
    letterSpacing: -0.44,
  },
})
