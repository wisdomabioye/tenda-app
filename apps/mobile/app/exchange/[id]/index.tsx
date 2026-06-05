/**
 * Exchange detail (cutover §6 rewrite): read surface over /v1/exchange/:id
 * (escrows kind='exchange' ⨝ exchange_details); every transition rides the
 * shared escrow action hook — the same sign → broadcast → client-ping leg
 * as gigs. CTA logic lives in ExchangeCTA; chrome/CTA-frame/dispute/report
 * blocks are the shared escrow detail components.
 */
import { useCallback, useState } from 'react'
import { ScrollView, StyleSheet, RefreshControl, View } from 'react-native'
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router'
import { spacing, typography } from '@/theme/tokens'
import {
  ScreenContainer,
  Text,
  Badge,
  Divider,
  Spacer,
  EmptyState,
  showToast,
} from '@/components/ui'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { GigActionSheets, type ActiveSheet } from '@/components/gig'
import { ExchangeStatusBadge, ExchangeTermsCard, ExchangeCTA } from '@/components/exchange'
import {
  DetailChrome,
  DetailBottomBar,
  DisputeReasonBlock,
  ReportContentLink,
} from '@/components/escrow'
import { PersonCard, ReviewsSection } from '@/components/shared'
import { TransactionMonitor, LoadingScreen, ErrorState } from '@/components/feedback'
import { ReportSheet } from '@/components/moderation/ReportSheet'
import { useAuthStore } from '@/stores'
import { api } from '@/api/client'
import { formatFiat } from '@/lib/currency'
import { useEscrowActions, type ProofFile } from '@/hooks/useEscrowActions'
import { formatAssetAmount } from '@tenda/shared'
import type { EscrowTxType, ExchangeDetail, SupportedCurrency } from '@tenda/shared'

const SUCCESS_BY_ACTION: Partial<Record<EscrowTxType, string>> = {
  accept: 'Offer accepted!',
  submit: 'Payment marked — waiting for the seller to confirm.',
  approve: 'Payment confirmed — crypto released.',
  claim_stalled: 'Payment claimed!',
  cancel: 'Offer cancelled — escrow refunded.',
  refund_expired: 'Refund claimed successfully.',
  dispute: 'Dispute raised. An admin will review shortly.',
}

function ExchangeDetailContent({
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
  const [reportOpen, setReportOpen] = useState(false)
  const [refreshing, setRefreshing] = useState(false)

  const actions = useEscrowActions({ escrowId: offer.escrow_id, chainId: offer.chain_id })
  const isCreator = userId === offer.creator.id
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
    return actions.dispute(reason, offer.dispute_bond_raw)
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
        <ExchangeCTA offer={offer} userId={userId} actions={actions} onSheet={setActiveSheet} />
      </DetailBottomBar>

      <GigActionSheets
        gig={offer}
        activeSheet={activeSheet}
        onClose={() => setActiveSheet(null)}
        onReviewSubmitted={() => void refresh()}
        onAcceptConfirmed={() => void actions.accept()}
        onCancelOpenConfirmed={() => void actions.cancel()}
        onRefundExpiredConfirmed={() =>
          void actions.refund(offer.status === 'open' ? 'refund_expired' : 'reclaim_abandoned')
        }
        onProofsReady={handleProofsReady}
        onAddProofsReady={handleAddProofsReady}
        onDisputeReady={handleDisputeReady}
      />

      <TransactionMonitor
        signature={actions.pendingTxRef}
        escrowId={offer.escrow_id}
        onConfirmed={handleTransactionConfirmed}
        onFailed={(msg) => {
          actions.clearPending()
          showToast('info', msg || 'Transaction pending — will sync when confirmed')
        }}
      />

      <ReportSheet
        visible={reportOpen}
        onClose={() => setReportOpen(false)}
        contentType="escrow"
        contentId={offer.escrow_id}
      />
    </ScreenContainer>
  )
}

export default function ExchangeDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const router = useRouter()
  const user = useAuthStore((s) => s.user)

  const [offer, setOffer] = useState<ExchangeDetail | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchOffer = useCallback(async () => {
    if (!id) return
    setError(null)
    try {
      setOffer(await api.exchange.get({ id }))
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setIsLoading(false)
    }
  }, [id])

  useFocusEffect(
    useCallback(() => {
      void fetchOffer()
    }, [fetchOffer]),
  )

  if (isLoading && !offer) return <LoadingScreen />

  if (error && !offer) {
    return (
      <ScreenContainer>
        <ErrorState
          title="Failed to load offer"
          description={error}
          ctaLabel="Retry"
          onCtaPress={() => void fetchOffer()}
        />
      </ScreenContainer>
    )
  }

  if (!offer) {
    return (
      <ScreenContainer>
        <EmptyState
          title="Offer not found"
          description="This offer may have been removed"
          action={{ label: 'Go back', onPress: () => router.back() }}
        />
      </ScreenContainer>
    )
  }

  return <ExchangeDetailContent offer={offer} userId={user?.id ?? ''} refresh={fetchOffer} />
}

const s = StyleSheet.create({
  flex: { flex: 1 },
  content: { paddingHorizontal: spacing.md },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  title: {
    fontFamily: typography.fonts.mono,
    fontSize: 22,
    lineHeight: 28,
    fontWeight: '700',
    letterSpacing: -0.44,
  },
})
