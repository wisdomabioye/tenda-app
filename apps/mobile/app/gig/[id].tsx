import { useCallback, useState } from 'react'
import { View, ScrollView, StyleSheet, Image, Alert, Pressable, RefreshControl } from 'react-native'
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router'
import { useUnistyles } from 'react-native-unistyles'
import {
  MapPin,
  Clock,
  Calendar,
  Share2,
  FileText,
  Film,
  Play,
  MessageCircle,
} from 'lucide-react-native'
import { Transaction, PublicKey } from '@solana/web3.js'
import { Buffer } from 'buffer'
import { spacing, radius, typography } from '@/theme/tokens'
import { ScreenContainer } from '@/components/ui/ScreenContainer'
import { Header } from '@/components/ui/Header'
import { Text } from '@/components/ui/Text'
import { IconButton } from '@/components/ui/IconButton'
import { Avatar } from '@/components/ui/Avatar'
import { Card } from '@/components/ui/Card'
import { MoneyText } from '@/components/ui/MoneyText'
import { Divider } from '@/components/ui/Divider'
import { Spacer } from '@/components/ui/Spacer'
import { EmptyState } from '@/components/ui/EmptyState'
import { showToast } from '@/components/ui/Toast'
import { GigStatusBadge, ReviewCard } from '@/components/gig'
import { TransactionMonitor } from '@/components/feedback/TransactionMonitor'
import { LoadingScreen } from '@/components/feedback/LoadingScreen'
import { ErrorState } from '@/components/feedback/ErrorState'
import { GigCTABar, GigActionSheets } from '@/components/gig'
import { NudgeSheet } from '@/components/onboarding/NudgeSheet'
import { ProofViewerModal } from '@/components/gig/ProofViewerModal'
import type { ProofItem } from '@/components/gig/ProofViewerModal'
import { useOnboardingStore } from '@/stores/onboarding.store'
import { getCategoryColor, CATEGORY_META } from '@/data/mock'
import { useAuthStore } from '@/stores/auth.store'
import { useGigsStore } from '@/stores/gigs.store'
import { usePendingSyncStore } from '@/stores/pending-sync.store'
import { useExchangeRateStore } from '@/stores/exchange-rate.store'
import { toPaymentDisplay } from '@/lib/currency'
import { computeRelevantDeadline, computePlatformFee, SOLANA_TX_FEE_LAMPORTS } from '@tenda/shared'
import { deadlineLabel, formatDuration, formatDeadline } from '@/lib/gig-display'
import { api } from '@/api/client'
import { signAndSendTransactionWithWallet, signTransactionsWithWallet, sendRawTransaction, getBalance } from '@/wallet'
import type { ColorScheme } from '@/theme/tokens'
import type { GigDetail } from '@tenda/shared'
import type { ActiveSheet } from '@/components/gig'

type PendingAction =
  | { type: 'publish' }
  | { type: 'accept' }
  | { type: 'approve' }
  | { type: 'cancel' }
  | { type: 'refund' }
  | { type: 'submit'; proofs: Array<{ url: string; type: 'image' | 'video' | 'document' }> }
  | { type: 'dispute'; reason: string }

// ─── Inner component (receives non-null gig) ─────────────────────────────────

function GigDetailContent({ gig, userId }: { gig: GigDetail; userId: string }) {
  const router = useRouter()
  const { theme } = useUnistyles()
  const mwaAuthToken = useAuthStore((s) => s.mwaAuthToken)
  const { fetchGigDetail, acceptGig, submitProof, disputeGig } = useGigsStore()
  const pendingSync = usePendingSyncStore()
  const solToNgn = useExchangeRateStore((s) => s.solToNgn)

  const [activeSheet, setActiveSheet] = useState<ActiveSheet | null>(null)
  const [selectedProof, setSelectedProof] = useState<ProofItem | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [isTxBuilding, setIsTxBuilding] = useState(false)
  const [pendingSignature, setPendingSignature] = useState<string | null>(null)
  const [pendingSetupSignature, setPendingSetupSignature] = useState<string | null>(null)
  const [pendingAcceptTx, setPendingAcceptTx] = useState<Transaction | null>(null)
  const [pendingSyncId, setPendingSyncId] = useState<string | null>(null)
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null)
  const [showAcceptNudge, setShowAcceptNudge] = useState(false)
  const { dismissedNudges } = useOnboardingStore()

  const isWorkerOpportunity = gig.status === 'open' && gig.poster_id !== userId

  useFocusEffect(useCallback(() => {
    if (isWorkerOpportunity && !dismissedNudges.accept) {
      setShowAcceptNudge(true)
    }
  }, [isWorkerOpportunity, dismissedNudges.accept]))

  const categoryMeta = CATEGORY_META.find((c) => c.key === gig.category)
  const categoryColorKey = getCategoryColor(gig.category) as keyof ColorScheme
  const categoryColor = theme.colors[categoryColorKey]
  const price = toPaymentDisplay(gig.payment_lamports, solToNgn)
  const deadline = computeRelevantDeadline(gig)
  const deadlineLbl = deadlineLabel(deadline)

  const posterName = [gig.poster.first_name, gig.poster.last_name]
    .filter(Boolean)
    .join(' ') || 'Anonymous'
  const workerName = gig.worker
    ? [gig.worker.first_name, gig.worker.last_name].filter(Boolean).join(' ') || 'Anonymous'
    : null

  async function handleRefresh() {
    setRefreshing(true)
    try { await fetchGigDetail(gig.id) } finally { setRefreshing(false) }
  }

  // ── Shared: sign tx and enter monitoring state ──────────────────────────────

  function onNewAuthToken(token: string) {
    useAuthStore.getState().setMwaAuthToken(token)
  }

  async function startBlockchainFlow(
    action: PendingAction,
    txBase64: string,
    syncAction?: 'publish' | 'approve' | 'cancel' | 'accept' | 'refund',
  ) {
    if (!mwaAuthToken) {
      showToast('error', 'Wallet not connected — please reconnect and try again')
      return
    }
    try {
      const tx = Transaction.from(Buffer.from(txBase64, 'base64'))
      const sig = await signAndSendTransactionWithWallet(tx as any, mwaAuthToken, onNewAuthToken)
      if (syncAction) {
        const syncId = pendingSync.add({ gigId: gig.id, action: syncAction, signature: sig })
        setPendingSyncId(syncId)
      }
      setPendingAction(action)
      setPendingSignature(sig)
    } catch (e) {
      // Clear any partial state so the CTA bar becomes interactive again
      setPendingSignature(null)
      setPendingAction(null)
      setPendingSyncId(null)
      throw e
    }
  }

  // ── Blockchain handlers ────────────────────────────────────────────────────

  async function handlePublish() {
    if (!mwaAuthToken) return
    setIsTxBuilding(true)
    try {
      const walletAddress = useAuthStore.getState().walletAddress
      if (walletAddress) {
        const { fee_bps } = await api.platform.config()
        const platformFee = BigInt(computePlatformFee(BigInt(gig.payment_lamports), fee_bps))
        const required = BigInt(gig.payment_lamports) + platformFee + SOLANA_TX_FEE_LAMPORTS
        const balance = BigInt(await getBalance(new PublicKey(walletAddress)))
        if (balance < required) {
          Alert.alert('Insufficient SOL', 'Your wallet does not have enough SOL to fund this gig.')
          return
        }
      }
      const { transaction } = await api.blockchain.createEscrow({ gig_id: gig.id })
      await startBlockchainFlow({ type: 'publish' }, transaction, 'publish')
    } catch (e) {
      showToast('error', (e as Error).message || 'Failed to build publish transaction')
    } finally {
      setIsTxBuilding(false)
    }
  }

  async function handleAccept() {
    if (!mwaAuthToken) return
    setIsTxBuilding(true)
    try {
      const response = await api.blockchain.acceptGig({ gig_id: gig.id })

      if (response.setup_transaction) {
        showToast('info', 'One-time setup: your worker account will be created on-chain. This only happens once.')
        await new Promise<void>((r) => setTimeout(r, 1200))

        const setupTx  = Transaction.from(Buffer.from(response.setup_transaction, 'base64'))
        const acceptTx = Transaction.from(Buffer.from(response.transaction, 'base64'))
        const [signedSetup, signedAccept] = await signTransactionsWithWallet(
          [setupTx, acceptTx] as any[],
          mwaAuthToken,
          onNewAuthToken,
        ) as [Transaction, Transaction]

        const setupSig = await sendRawTransaction(signedSetup)
        setPendingAcceptTx(signedAccept)
        setPendingAction({ type: 'accept' })
        setPendingSetupSignature(setupSig)
      } else {
        await startBlockchainFlow({ type: 'accept' }, response.transaction, 'accept')
      }
    } catch (e) {
      setPendingSetupSignature(null)
      setPendingAcceptTx(null)
      setPendingAction(null)
      showToast('error', (e as Error).message || 'Failed to build accept transaction')
    } finally {
      setIsTxBuilding(false)
    }
  }

  // Called by TransactionMonitor when the setup (create_user_account) tx confirms.
  // Broadcasts the pre-signed accept_gig transaction and hands off to the main monitor.
  async function handleSetupConfirmed() {
    if (!pendingAcceptTx) return
    try {
      const acceptSig = await sendRawTransaction(pendingAcceptTx)
      const syncId = pendingSync.add({ gigId: gig.id, action: 'accept', signature: acceptSig })
      setPendingSyncId(syncId)
      setPendingSetupSignature(null)
      setPendingAcceptTx(null)
      setPendingSignature(acceptSig)
    } catch (e) {
      setPendingSetupSignature(null)
      setPendingAcceptTx(null)
      setPendingAction(null)
      showToast('error', (e as Error).message || 'Failed to broadcast accept transaction')
    }
  }

  async function handleApprove() {
    if (!mwaAuthToken) return
    setIsTxBuilding(true)
    try {
      const { transaction } = await api.blockchain.approveEscrow({ gig_id: gig.id })
      await startBlockchainFlow({ type: 'approve' }, transaction, 'approve')
    } catch (e) {
      showToast('error', (e as Error).message || 'Failed to build approve transaction')
    } finally {
      setIsTxBuilding(false)
    }
  }

  async function handleCancelOpen() {
    if (!mwaAuthToken) return
    setIsTxBuilding(true)
    try {
      const { transaction } = await api.blockchain.cancelEscrow({ gig_id: gig.id })
      await startBlockchainFlow({ type: 'cancel' }, transaction, 'cancel')
    } catch (e) {
      showToast('error', (e as Error).message || 'Failed to build cancel transaction')
    } finally {
      setIsTxBuilding(false)
    }
  }

  async function handleRefundExpired() {
    if (!mwaAuthToken) return
    setIsTxBuilding(true)
    try {
      const { transaction } = await api.blockchain.refundExpired({ gig_id: gig.id })
      await startBlockchainFlow({ type: 'refund' }, transaction, 'refund')
    } catch (e) {
      showToast('error', (e as Error).message || 'Failed to build refund transaction')
    } finally {
      setIsTxBuilding(false)
    }
  }

  // Called by GigActionSheets after user confirms dispute reason
  async function handleDisputeReady(reason: string) {
    if (!mwaAuthToken) return
    try {
      const { transaction } = await api.blockchain.disputeGig({ gig_id: gig.id, reason })
      const tx = Transaction.from(Buffer.from(transaction, 'base64'))
      const sig = await signAndSendTransactionWithWallet(tx as any, mwaAuthToken, onNewAuthToken)
      setPendingAction({ type: 'dispute', reason })
      setPendingSignature(sig)
    } catch (e) {
      showToast('error', (e as Error).message || 'Failed to build dispute transaction')
    }
  }

  // Called by GigActionSheets when worker adds supplementary proof (no blockchain step)
  async function handleAddProofsReady(
    proofs: Array<{ url: string; type: 'image' | 'video' | 'document' }>,
  ) {
    try {
      await api.gigs.addProofs({ id: gig.id }, { proofs })
      showToast('success', 'Proof added!')
      fetchGigDetail(gig.id)
    } catch (e) {
      showToast('error', (e as Error).message || 'Failed to add proof — please try again')
    }
  }

  // Called by GigActionSheets after Cloudinary uploads are done
  async function handleProofsReady(
    proofs: Array<{ url: string; type: 'image' | 'video' | 'document' }>,
  ) {
    if (!mwaAuthToken) return
    try {
      const { transaction } = await api.blockchain.submitProof({ gig_id: gig.id })
      const tx = Transaction.from(Buffer.from(transaction, 'base64'))
      const sig = await signAndSendTransactionWithWallet(tx as any, mwaAuthToken, onNewAuthToken)
      // Add to pending-sync with proofs so a retry can recover if server call fails
      const syncId = pendingSync.add({ action: 'submit', gigId: gig.id, signature: sig, proofs })
      setPendingSyncId(syncId)
      setPendingAction({ type: 'submit', proofs })
      setPendingSignature(sig)
    } catch (e) {
      showToast('error', (e as Error).message || 'Failed to build submit transaction')
    }
  }

  // ── TransactionMonitor confirmed callback ──────────────────────────────────

  async function handleTransactionConfirmed() {
    const sig = pendingSignature!
    const action = pendingAction!
    const syncId = pendingSyncId
    setPendingSignature(null)
    setPendingAction(null)
    setPendingSyncId(null)

    const successMessages: Record<PendingAction['type'], string> = {
      publish: 'Gig published!',
      accept:  'Gig accepted!',
      approve: 'Payment released to worker!',
      cancel:  'Gig cancelled — escrow refunded.',
      refund:  'Refund claimed successfully.',
      submit:  'Proof submitted!',
      dispute: 'Dispute raised. An admin will review shortly.',
    }

    try {
      switch (action.type) {
        case 'publish':
          await api.gigs.publish({ id: gig.id }, { signature: sig })
          break
        case 'accept':
          await acceptGig(gig.id, { signature: sig })
          break
        case 'approve':
          await api.gigs.approve({ id: gig.id }, { signature: sig })
          break
        case 'cancel':
          await api.gigs.delete({ id: gig.id }, { signature: sig })
          break
        case 'refund':
          await api.gigs.refund({ id: gig.id }, { signature: sig })
          break
        case 'submit':
          await submitProof(gig.id, { proofs: action.proofs, signature: sig })
          break
        case 'dispute':
          await disputeGig(gig.id, { reason: action.reason, signature: sig })
          break
      }

      if (syncId) pendingSync.remove(syncId)
      showToast('success', successMessages[action.type])

      if (action.type === 'cancel') {
        router.back()
      } else {
        fetchGigDetail(gig.id)
      }
    } catch {
      showToast('info', 'Changes saved locally — will sync when reconnected')
    }
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
    <ScreenContainer scroll={false} padding={false} edges={['top', 'left', 'right', 'bottom']}>
      <Header showBack rightIcon={Share2} onRightPress={() => {}} />

      <ScrollView
        style={s.flex}
        contentContainerStyle={s.content}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
      >
        {/* Header badges */}
        <View style={s.headerRow}>
          <GigStatusBadge status={gig.status} />
          {categoryMeta && (
            <View style={[s.categoryBadge, { backgroundColor: `${categoryColor}20` }]}>
              <View style={[s.categoryDot, { backgroundColor: categoryColor }]} />
              <Text variant="caption" weight="medium" color={categoryColor}>
                {categoryMeta.label}
              </Text>
            </View>
          )}
        </View>

        <Spacer size={spacing.sm} />
        <Text variant="heading">{gig.title}</Text>
        <Spacer size={spacing.md} />
        <MoneyText naira={price.naira} sol={price.sol} size={typography.sizes.xl} />
        <Spacer size={spacing.lg} />

        {/* Meta info */}
        <View style={s.metaGrid}>
          <View style={s.metaItem}>
            <MapPin size={16} color={theme.colors.textFaint} />
            <Text variant="body" color={theme.colors.textSub}>{gig.address ?? gig.city}</Text>
          </View>
          {deadlineLbl ? (
            <View style={s.metaItem}>
              <Clock size={16} color={theme.colors.textFaint} />
              <Text variant="body" color={theme.colors.textSub}>{deadlineLbl}</Text>
            </View>
          ) : null}
          <View style={s.metaItem}>
            <Calendar size={16} color={theme.colors.textFaint} />
            <Text variant="body" color={theme.colors.textSub}>
              {`${formatDuration(gig.completion_duration_seconds)} to complete after acceptance`}
            </Text>
          </View>
          {gig.accept_deadline && (
            <View style={s.metaItem}>
              <Clock size={16} color={theme.colors.textFaint} />
              <Text variant="body" color={theme.colors.textSub}>
                Accept by {formatDeadline(gig.accept_deadline)}
              </Text>
            </View>
          )}
        </View>

        <Divider />

        {/* Description */}
        <Text variant="subheading">Description</Text>
        <Spacer size={spacing.sm} />
        <Text variant="body" color={theme.colors.textSub}>{gig.description}</Text>

        <Divider />

        {/* Poster */}
        <Text variant="subheading">Posted by</Text>
        <Spacer size={spacing.sm} />
        <Card variant="outlined">
          <View style={s.personRow}>
            <Avatar size="md" name={posterName} src={gig.poster.avatar_url} />
            <View style={s.personInfo}>
              <Text variant="body" weight="semibold">{posterName}</Text>
              <Text variant="caption" color={theme.colors.textSub}>
                {gig.poster.reputation_score ?? 0} reputation
              </Text>
            </View>
            {userId !== gig.poster_id && (
              <IconButton
                icon={<MessageCircle size={20} color={theme.colors.primary} />}
                onPress={() => router.push(`/chat/${gig.poster_id}` as Parameters<typeof router.push>[0])}
                variant="ghost"
              />
            )}
          </View>
        </Card>

        {/* Worker */}
        {gig.worker && (
          <>
            <Spacer size={spacing.md} />
            <Text variant="subheading">Assigned to</Text>
            <Spacer size={spacing.sm} />
            <Card variant="outlined">
              <View style={s.personRow}>
                <Avatar size="md" name={workerName ?? ''} src={gig.worker.avatar_url} />
                <View style={s.personInfo}>
                  <Text variant="body" weight="semibold">{workerName}</Text>
                  <Text variant="caption" color={theme.colors.textSub}>
                    {gig.worker.reputation_score ?? 0} reputation
                  </Text>
                </View>
                {userId !== gig.worker.id && (
                  <IconButton
                    icon={<MessageCircle size={20} color={theme.colors.primary} />}
                    onPress={() => router.push(`/chat/${gig.worker!.id}` as Parameters<typeof router.push>[0])}
                    variant="ghost"
                  />
                )}
              </View>
            </Card>
          </>
        )}

        {/* Reviews */}
        {gig.reviews.length > 0 && (
          <>
            <Divider />
            <Text variant="subheading">Reviews</Text>
            <Spacer size={spacing.sm} />
            <View style={s.reviewsStack}>
              {gig.reviews.map((review) => {
                const isPoster  = review.reviewer_id === gig.poster_id
                const reviewer  = isPoster ? gig.poster : gig.worker
                const roleLabel = isPoster ? 'Poster' : 'Worker'
                const label     = review.reviewer_id === userId ? `Your review (${roleLabel})` : `${roleLabel}'s review`
                if (!reviewer) return null
                return (
                  <ReviewCard
                    key={review.id}
                    review={review}
                    reviewer={reviewer}
                    label={label}
                  />
                )
              })}
            </View>
          </>
        )}

        {/* Proofs */}
        {gig.proofs.length > 0 && (
          <>
            <Divider />
            <Text variant="subheading">Proof of work</Text>
            <Spacer size={spacing.sm} />
            <View style={s.proofsGrid}>
              {gig.proofs.map((proof) => (
                <Pressable
                  key={proof.id}
                  style={[s.proofItem, { backgroundColor: theme.colors.muted }]}
                  onPress={() => setSelectedProof(proof)}
                >
                  {proof.type === 'image' ? (
                    <Image source={{ uri: proof.url }} style={s.proofThumb} />
                  ) : (
                    <View style={s.proofIcon}>
                      {proof.type === 'video'
                        ? <Film size={24} color={theme.colors.textSub} />
                        : <FileText size={24} color={theme.colors.textSub} />}
                      <Text size={10} color={theme.colors.textSub} numberOfLines={1}>
                        {proof.type}
                      </Text>
                    </View>
                  )}
                  {/* Play badge for videos */}
                  {proof.type === 'video' && (
                    <View style={[s.playBadge, { backgroundColor: theme.colors.primary }]}>
                      <Play size={8} color={theme.colors.onPrimary} fill={theme.colors.onPrimary} />
                    </View>
                  )}
                </Pressable>
              ))}
            </View>
          </>
        )}

        {/* Dispute reason */}
        {gig.dispute && gig.status === 'disputed' && (
          <>
            <Divider />
            <View style={[s.disputeBlock, { backgroundColor: theme.colors.dangerTint }]}>
              <Text weight="semibold" color={theme.colors.danger}>Dispute reason</Text>
              <Spacer size={4} />
              <Text variant="caption" color={theme.colors.danger}>{gig.dispute.reason}</Text>
            </View>
          </>
        )}

        <Spacer size={spacing['2xl']} />
      </ScrollView>

      <GigCTABar
        gig={gig}
        userId={userId}
        isTxBuilding={isTxBuilding}
        txInProgress={pendingSignature !== null || pendingSetupSignature !== null}
        onAction={setActiveSheet}
        onPublish={handlePublish}
        onApprove={handleApprove}
      />

      <GigActionSheets
        gig={gig}
        activeSheet={activeSheet}
        onClose={() => setActiveSheet(null)}
        onReviewSubmitted={() => fetchGigDetail(gig.id)}
        onAcceptConfirmed={handleAccept}
        onCancelOpenConfirmed={handleCancelOpen}
        onRefundExpiredConfirmed={handleRefundExpired}
        onProofsReady={handleProofsReady}
        onAddProofsReady={handleAddProofsReady}
        onDisputeReady={handleDisputeReady}
      />

      <TransactionMonitor
        signature={pendingSetupSignature}
        setupPhase
        onConfirmed={handleSetupConfirmed}
        onFailed={(msg) => {
          setPendingSetupSignature(null)
          setPendingAcceptTx(null)
          setPendingAction(null)
          showToast('info', msg || 'Account setup failed — please try again')
        }}
      />

      <TransactionMonitor
        signature={pendingSignature}
        onConfirmed={handleTransactionConfirmed}
        onFailed={(msg) => {
          setPendingSignature(null)
          setPendingAction(null)
          showToast('info', msg || 'Transaction pending — will sync when confirmed')
        }}
      />

      <ProofViewerModal proof={selectedProof} onClose={() => setSelectedProof(null)} />
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

  if (isLoading && (!selectedGig || selectedGig.id !== id)) return <LoadingScreen />

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

const PROOF_SIZE = 72

const s = StyleSheet.create({
  flex: { flex: 1 },
  content: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  categoryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: radius.full,
  },
  categoryDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  metaGrid: {
    gap: spacing.sm,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  personRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  personInfo: {
    flex: 1,
  },
  reviewsStack: {
    gap: spacing.sm,
  },
  proofsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  proofItem: {
    width: PROOF_SIZE,
    height: PROOF_SIZE,
    borderRadius: radius.sm,
    overflow: 'hidden',
  },
  proofThumb: {
    width: PROOF_SIZE,
    height: PROOF_SIZE,
  },
  proofIcon: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  playBadge: {
    position: 'absolute',
    bottom: 4,
    right: 4,
    width: 16,
    height: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  disputeBlock: {
    borderRadius: radius.md,
    padding: spacing.md,
  },
})
