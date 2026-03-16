import { useCallback, useState } from 'react'
import { View, ScrollView, StyleSheet, RefreshControl, Share, Pressable } from 'react-native'
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router'
import { useUnistyles } from 'react-native-unistyles'
import { Share2, Pencil } from 'lucide-react-native'
import { Transaction } from '@solana/web3.js'
import { Buffer } from 'buffer'
import { spacing, radius, typography } from '@/theme/tokens'
import { 
  ScreenContainer,
  Header,
  Text,
  MoneyText,
  Divider,
  Spacer,
  EmptyState,
  showToast
} from '@/components/ui'
import { 
  GigStatusBadge, 
  GigMetaInfo, 
  GigPersonCard, 
  GigProofsGrid, 
  GigReviewsSection,
  GigCTABar, 
  GigActionSheets,
  ProofViewerModal,
  type ProofItem,
  type ActiveSheet
} from '@/components/gig'
import { 
  TransactionMonitor,
  InsufficientBalanceSheet,
  LoadingScreen,
  ErrorState, 
} from '@/components/feedback'
import { NudgeSheet } from '@/components/onboarding/NudgeSheet'
import { ReportSheet } from '@/components/moderation/ReportSheet'
import { useOnboardingStore } from '@/stores/onboarding.store'
import { getCategoryColor, CATEGORY_META } from '@/data/mock'
import { 
  useAuthStore,
  useGigsStore,
  usePendingSyncStore,
  useExchangeRateStore,
  useSettingsStore
} from '@/stores'
import { 
  computeRelevantDeadline, 
  computePlatformFee, 
  SOLANA_TX_FEE_LAMPORTS, 
  apiConfig 
} from '@tenda/shared'
import { getEnv } from '@/lib/env'
import { toPaymentDisplay } from '@/lib/currency'
import { deadlineLabel } from '@/lib/gig-display'
import { checkBalance } from '@/lib/balance'
import { api } from '@/api/client'
import {
  signAndSendTransactionWithWallet,
  signTransactionsWithWallet,
  sendRawTransaction,
  validateTransaction,
  WalletError,
} from '@/wallet'
import type { ColorScheme } from '@/theme/tokens'
import type { GigDetail } from '@tenda/shared'
import type { InstructionName } from '@tenda/shared/idl'

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
  const isSeeker = useAuthStore((s) => s.user?.is_seeker ?? false)
  const { fetchGigDetail, acceptGig, submitProof, disputeGig } = useGigsStore()
  const pendingSync = usePendingSyncStore()
  const rates = useExchangeRateStore((s) => s.rates)
  const currency = useSettingsStore((s) => s.currency)

  const [activeSheet, setActiveSheet] = useState<ActiveSheet | null>(null)
  const [selectedProof, setSelectedProof] = useState<ProofItem | null>(null)
  const [balanceShortfall, setBalanceShortfall] = useState<{ balance: bigint; required: bigint } | null>(null)
  const [reportGigOpen, setReportGigOpen] = useState(false)
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
  const rate = rates?.[currency] ?? null
  const price = toPaymentDisplay(gig.payment_lamports, rate)
  const deadline = computeRelevantDeadline(gig)
  const deadlineLbl = deadlineLabel(deadline)

  async function handleRefresh() {
    setRefreshing(true)
    try { await fetchGigDetail(gig.id) } finally { setRefreshing(false) }
  }

  const isDraftOwner = gig.status === 'draft' && userId === gig.poster_id

  function handleShare() {
    const baseUrl = apiConfig[getEnv()].baseUrl
    const url = `${baseUrl}/gig/${gig.id}`
    Share.share({ message: `${gig.title} on Tenda\n${url}` })
  }

  function handleEdit() {
    router.push(`/gig/${gig.id}/edit` as any)
  }

  async function guardBalance(required: bigint): Promise<boolean> {
    const walletAddress = useAuthStore.getState().walletAddress
    if (!walletAddress) return true
    const result = await checkBalance(walletAddress, required)
    if (!result.sufficient) {
      setBalanceShortfall({ balance: result.balance, required })
      return false
    }
    return true
  }

  // ── Shared: sign tx and enter monitoring state ──────────────────────────────

  function onNewAuthToken(token: string) {
    useAuthStore.getState().setMwaAuthToken(token)
  }

  async function startBlockchainFlow(
    action: PendingAction,
    txBase64: string,
    expectedInstruction: InstructionName,
    syncAction?: 'publish' | 'approve' | 'cancel' | 'accept' | 'refund',
  ) {
    if (!mwaAuthToken) {
      showToast('error', 'Wallet not connected — please reconnect and try again')
      return
    }
    try {
      const tx = Transaction.from(Buffer.from(txBase64, 'base64'))
      validateTransaction(tx, expectedInstruction)
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
      if (e instanceof WalletError && e.code === 'declined') return  // user cancelled — no error shown
      throw e
    }
  }

  // ── Blockchain handlers ────────────────────────────────────────────────────

  async function handlePublish() {
    if (!mwaAuthToken) return
    setIsTxBuilding(true)
    try {
      const { fee_bps, seeker_fee_bps } = await api.platform.config()
      const effectiveFeeBps = isSeeker ? seeker_fee_bps : fee_bps
      const platformFee = BigInt(computePlatformFee(BigInt(gig.payment_lamports), effectiveFeeBps))
      const required = BigInt(gig.payment_lamports) + platformFee + SOLANA_TX_FEE_LAMPORTS
      if (!await guardBalance(required)) return
      const { transaction } = await api.blockchain.createEscrow({ gig_id: gig.id })
      await startBlockchainFlow({ type: 'publish' }, transaction, 'create_gig_escrow', 'publish')
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
      if (!await guardBalance(SOLANA_TX_FEE_LAMPORTS)) return
      const response = await api.blockchain.acceptGig({ gig_id: gig.id })

      if (response.setup_transaction) {
        showToast('info', 'One-time setup: your worker account will be created on-chain. This only happens once.')
        await new Promise<void>((r) => setTimeout(r, 1200))

        const setupTx  = Transaction.from(Buffer.from(response.setup_transaction, 'base64'))
        const acceptTx = Transaction.from(Buffer.from(response.transaction, 'base64'))
        validateTransaction(setupTx, 'create_user_account')
        validateTransaction(acceptTx, 'accept_gig')
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
        await startBlockchainFlow({ type: 'accept' }, response.transaction, 'accept_gig', 'accept')
      }
    } catch (e) {
      setPendingSetupSignature(null)
      setPendingAcceptTx(null)
      setPendingAction(null)
      if (!(e instanceof WalletError && e.code === 'declined'))
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
      if (!await guardBalance(SOLANA_TX_FEE_LAMPORTS)) return
      const { transaction } = await api.blockchain.approveEscrow({ gig_id: gig.id })
      await startBlockchainFlow({ type: 'approve' }, transaction, 'approve_completion', 'approve')
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
      if (!await guardBalance(SOLANA_TX_FEE_LAMPORTS)) return
      const { transaction } = await api.blockchain.cancelEscrow({ gig_id: gig.id })
      await startBlockchainFlow({ type: 'cancel' }, transaction, 'cancel_gig', 'cancel')
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
      if (!await guardBalance(SOLANA_TX_FEE_LAMPORTS)) return
      const { transaction } = await api.blockchain.refundExpired({ gig_id: gig.id })
      await startBlockchainFlow({ type: 'refund' }, transaction, 'refund_expired', 'refund')
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
      if (!await guardBalance(SOLANA_TX_FEE_LAMPORTS)) return
      const { transaction } = await api.blockchain.disputeGig({ gig_id: gig.id, reason })
      const tx = Transaction.from(Buffer.from(transaction, 'base64'))
      validateTransaction(tx, 'dispute_gig')
      const sig = await signAndSendTransactionWithWallet(tx as any, mwaAuthToken, onNewAuthToken)
      setPendingAction({ type: 'dispute', reason })
      setPendingSignature(sig)
    } catch (e) {
      if (!(e instanceof WalletError && e.code === 'declined'))
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
      if (!await guardBalance(SOLANA_TX_FEE_LAMPORTS)) return
      const { transaction } = await api.blockchain.submitProof({ gig_id: gig.id })
      const tx = Transaction.from(Buffer.from(transaction, 'base64'))
      validateTransaction(tx, 'submit_proof')
      const sig = await signAndSendTransactionWithWallet(tx, mwaAuthToken, onNewAuthToken)
      // Add to pending-sync with proofs so a retry can recover if server call fails
      const syncId = pendingSync.add({ action: 'submit', gigId: gig.id, signature: sig, proofs })
      setPendingSyncId(syncId)
      setPendingAction({ type: 'submit', proofs })
      setPendingSignature(sig)
    } catch (e) {
      if (!(e instanceof WalletError && e.code === 'declined'))
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
    <ScreenContainer scroll={false} padding={false} edges={['left', 'right', 'bottom']}>
      <Header
        title="Gig"
        showBack
        rightIcon={isDraftOwner ? Pencil : Share2}
        onRightPress={isDraftOwner ? handleEdit : handleShare}
      />

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
        <MoneyText fiat={price.fiat} ratesReady={rates !== null} currency={currency} sol={price.sol} size={typography.sizes.xl} />
        <Spacer size={spacing.lg} />

        {/* Meta info */}
        <GigMetaInfo gig={gig} posterCountry={gig.poster.country} deadlineLbl={deadlineLbl} />

        <Divider />

        {/* Description */}
        <Text variant="subheading">Description</Text>
        <Spacer size={spacing.sm} />
        <Text variant="body" color={theme.colors.textSub}>{gig.description}</Text>

        <Divider />

        {/* Poster */}
        <GigPersonCard
          label="Posted by"
          user={gig.poster}
          currentUserId={userId}
          gigId={gig.id}
          gigTitle={gig.title}
          showMessageButton={gig.status === 'open' || userId === gig.worker?.id}
        />

        {/* Worker — only visible to participants (poster + worker) */}
        {gig.worker && (userId === gig.poster_id || userId === gig.worker.id) && (
          <>
            <Spacer size={spacing.md} />
            <GigPersonCard
              label="Assigned to"
              user={gig.worker}
              currentUserId={userId}
              gigId={gig.id}
              gigTitle={gig.title}
            />
          </>
        )}

        {/* Reviews */}
        {gig.reviews.length > 0 && (
          <>
            <Divider />
            <GigReviewsSection
              reviews={gig.reviews}
              posterId={gig.poster_id}
              poster={gig.poster}
              worker={gig.worker}
              currentUserId={userId}
            />
          </>
        )}

        {/* Proofs */}
        {gig.proofs.length > 0 && (
          <>
            <Divider />
            <Text variant="subheading">Proof of work</Text>
            <Spacer size={spacing.sm} />
            <GigProofsGrid proofs={gig.proofs} onProofPress={setSelectedProof} />
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

        {/* Report gig — shown to non-poster users only */}
        {userId !== gig.poster_id && (
          <>
            <Divider />
            <Pressable
              onPress={() => setReportGigOpen(true)}
              style={({ pressed }) => [s.reportLink, pressed && { opacity: 0.6 }]}
            >
              <Text variant="caption" color={theme.colors.textFaint}>Report this gig</Text>
            </Pressable>
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

      <ReportSheet
        visible={reportGigOpen}
        onClose={() => setReportGigOpen(false)}
        contentType="gig"
        contentId={gig.id}
      />

      <InsufficientBalanceSheet
        visible={balanceShortfall !== null}
        onClose={() => setBalanceShortfall(null)}
        balance={balanceShortfall?.balance ?? 0n}
        required={balanceShortfall?.required ?? 0n}
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
  disputeBlock: {
    borderRadius: radius.md,
    padding: spacing.md,
  },
  reportLink: {
    alignSelf: 'center',
    paddingVertical: spacing.sm,
  },
})
