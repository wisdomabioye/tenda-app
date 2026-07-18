/**
 * Gig detail (cutover §6 rewrite): read surface over /v1/gigs/:id; every
 * transition rides the shared escrow action hook (sign → broadcast →
 * client-ping). The scroll body lives in GigDetailBody; CTA visibility in
 * GigCTABar; sheets in GigActionSheets.
 */
import { useCallback, useState } from 'react'
import { ScrollView, StyleSheet, RefreshControl, Share } from 'react-native'
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Share2 } from 'lucide-react-native'
import { spacing } from '@/theme/tokens'
import { ScreenContainer, EmptyState, showToast } from '@/components/ui'
import {
  GigDetailBody,
  GigCTABar,
  GigActionSheets,
  type ActiveSheet,
} from '@/components/gig'
import { MediaViewerModal } from '@/components/shared/media/MediaViewerModal'
import type { MediaItem } from '@/components/shared/media/types'
import { DetailChrome, TxConfirmDialog, TX_PROGRESS_LABEL } from '@/components/escrow'
import { TransactionMonitor, LoadingScreen, ErrorState } from '@/components/feedback'
import { NudgeSheet } from '@/components/onboarding/NudgeSheet'
import { ReportSheet } from '@/components/moderation/ReportSheet'
import { useOnboardingStore } from '@/stores/onboarding.store'
import { useAuthStore, useGigsStore } from '@/stores'
import { apiConfig, formatAssetAmount } from '@tenda/shared'
import { getEnv } from '@/lib/env'
import { formatDuration } from '@/lib/gig-display'
import { useEscrowActions, type ProofFile } from '@/hooks/useEscrowActions'
import { useEscrowLiveRefresh } from '@/hooks/useEscrowLiveRefresh'
import type { EscrowTxType, GigDetail } from '@tenda/shared'

const SUCCESS_BY_ACTION: Partial<Record<EscrowTxType, string>> = {
  accept: 'Gig accepted!',
  approve: 'Payment released to worker!',
  claim_stalled: 'Payment claimed!',
  cancel: 'Gig cancelled, escrow refunded.',
  refund_expired: 'Refund claimed successfully.',
  reclaim_abandoned: 'Escrow reclaimed.',
  submit: 'Proof submitted!',
  dispute: 'Dispute raised. An admin will review shortly.',
}

function GigDetailContent({ gig, userId }: { gig: GigDetail; userId: string }) {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const { fetchGigDetail } = useGigsStore()

  const [activeSheet, setActiveSheet] = useState<ActiveSheet | null>(null)
  const [confirmAction, setConfirmAction] = useState<EscrowTxType | null>(null)
  const [selectedProof, setSelectedProof] = useState<MediaItem | null>(null)
  const [reportGigOpen, setReportGigOpen] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [showAcceptNudge, setShowAcceptNudge] = useState(false)
  const { dismissedNudges } = useOnboardingStore()

  const actions = useEscrowActions({
    escrowId: gig.escrow_id,
    chainId: gig.chain_id,
    asset: gig.asset,
    amountRaw: gig.amount_raw,
  })

  // Live-update when the counterparty acts (accept / submit / approve), not
  // just on focus — the escrow WS channel drives the refetch.
  useEscrowLiveRefresh(gig.escrow_id, () => fetchGigDetail(gig.escrow_id))

  // Fire the gated transition the confirm dialog was showing, then close it.
  function runConfirmedAction() {
    const action = confirmAction
    setConfirmAction(null)
    switch (action) {
      case 'accept': return void actions.accept()
      case 'approve': return void actions.approve()
      case 'claim_stalled': return void actions.claim()
      case 'cancel': return void actions.cancel()
      case 'refund_expired': return void actions.refund('refund_expired')
      case 'reclaim_abandoned': return void actions.refund('reclaim_abandoned')
    }
  }

  const isWorkerOpportunity = gig.status === 'open' && userId !== gig.creator.id

  useFocusEffect(
    useCallback(() => {
      if (isWorkerOpportunity && !dismissedNudges.accept) {
        setShowAcceptNudge(true)
      }
    }, [isWorkerOpportunity, dismissedNudges.accept]),
  )

  async function handleRefresh() {
    setRefreshing(true)
    try {
      await fetchGigDetail(gig.escrow_id)
    } finally {
      setRefreshing(false)
    }
  }

  function handleShare() {
    const baseUrl = apiConfig[getEnv()].baseUrl
    Share.share({ message: `${gig.title} on Tenda\n${baseUrl}/gig/${gig.escrow_id}` })
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
      void fetchGigDetail(gig.escrow_id)
    }
  }

  // Sheet-confirmed handlers (sheets collect input; the hook signs).
  async function handleProofsReady(proofs: ProofFile[]): Promise<boolean> {
    return actions.submit(proofs)
  }

  async function handleAddProofsReady(proofs: ProofFile[]): Promise<void> {
    if (await actions.addProofs(proofs)) {
      void fetchGigDetail(gig.escrow_id)
    }
  }

  async function handleDisputeReady(reason: string): Promise<boolean> {
    return actions.dispute(reason, gig.dispute_bond_raw)
  }

  return (
    <>
      <NudgeSheet
        visible={showAcceptNudge}
        nudgeKey="accept"
        title="Accepting your first gig"
        body="Once you accept, the payment is already locked in escrow, you just need to complete the work and submit proof. The poster approves and you get paid instantly."
        guideRoute="/(support)/working"
        onClose={() => setShowAcceptNudge(false)}
      />
      <ScreenContainer scroll={false} padding={false} edges={['left', 'right', 'bottom']}>
        <DetailChrome
          onBack={() => router.back()}
          rightIcon={Share2}
          rightLabel="Share"
          onRightPress={handleShare}
        />

        <ScrollView
          style={s.flex}
          contentContainerStyle={[s.content, { paddingTop: insets.top + 60 }]}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
        >
          <GigDetailBody
            gig={gig}
            userId={userId}
            onProofPress={setSelectedProof}
            onReport={() => setReportGigOpen(true)}
            onOpenDisputeThread={() =>
              router.push(`/dispute/${gig.escrow_id}` as Parameters<typeof router.push>[0])
            }
          />
        </ScrollView>

        <GigCTABar
          gig={gig}
          userId={userId}
          isTxBuilding={actions.busyAction !== null}
          txInProgress={actions.pendingTxRef !== null}
          onAction={setActiveSheet}
          onTxAction={setConfirmAction}
          onRetryDraft={() =>
            router.push(`/(tabs)/create-gig?draftId=${gig.escrow_id}` as Parameters<typeof router.push>[0])
          }
        />

        <TxConfirmDialog
          action={confirmAction}
          ctx={{
            amount: formatAssetAmount(gig.amount_raw, gig.asset),
            kind: 'gig',
            deliverWithin:
              gig.completion_duration_seconds != null ? formatDuration(gig.completion_duration_seconds) : null,
          }}
          onConfirm={runConfirmedAction}
          onCancel={() => setConfirmAction(null)}
        />

        <GigActionSheets
          gig={gig}
          activeSheet={activeSheet}
          onClose={() => setActiveSheet(null)}
          onReviewSubmitted={() => fetchGigDetail(gig.escrow_id)}
          onProofsReady={handleProofsReady}
          onAddProofsReady={handleAddProofsReady}
          onDisputeReady={handleDisputeReady}
        />

        <TransactionMonitor
          signature={actions.pendingTxRef}
          phase={actions.phase}
          actionLabel={actions.activeAction !== null ? TX_PROGRESS_LABEL[actions.activeAction] : undefined}
          escrowId={gig.escrow_id}
          chainId={gig.chain_id}
          onConfirmed={handleTransactionConfirmed}
          onFailed={(msg) => {
            actions.clearPending()
            showToast('info', msg || 'Transaction pending, will sync when confirmed')
          }}
        />

        <MediaViewerModal item={selectedProof} onClose={() => setSelectedProof(null)} />

        <ReportSheet
          visible={reportGigOpen}
          onClose={() => setReportGigOpen(false)}
          contentType="escrow"
          contentId={gig.escrow_id}
        />
      </ScreenContainer>
    </>
  )
}

// ─── Route wrapper ────────────────────────────────────────────────────────────

export default function GigDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const router = useRouter()
  const user = useAuthStore((s) => s.user)
  const { selectedGig, isLoading, error, fetchGigDetail } = useGigsStore()

  useFocusEffect(
    useCallback(() => {
      if (id) fetchGigDetail(id)
    }, [id]), // eslint-disable-line react-hooks/exhaustive-deps
  )

  if (isLoading && (!selectedGig || selectedGig.escrow_id !== id)) return <LoadingScreen />

  if (error && !selectedGig) {
    return (
      <ScreenContainer>
        <ErrorState
          title="Failed to load gig"
          description={error}
          ctaLabel="Retry"
          onCtaPress={() => id && fetchGigDetail(id)}
        />
      </ScreenContainer>
    )
  }

  if (!selectedGig) {
    return (
      <ScreenContainer>
        <EmptyState
          title="Gig not found"
          description="This gig may have been removed"
          action={{ label: 'Go back', onPress: () => router.back() }}
        />
      </ScreenContainer>
    )
  }

  return <GigDetailContent gig={selectedGig} userId={user?.id ?? ''} />
}

const s = StyleSheet.create({
  flex: { flex: 1 },
  content: {
    paddingHorizontal: spacing.md,
  },
})
