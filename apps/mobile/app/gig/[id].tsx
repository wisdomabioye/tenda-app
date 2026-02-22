import { useCallback, useState } from 'react'
import { View, ScrollView, StyleSheet, Image, Alert } from 'react-native'
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router'
import { useUnistyles } from 'react-native-unistyles'
import {
  ArrowLeft,
  MapPin,
  Clock,
  Calendar,
  Share2,
  FileText,
  Film,
} from 'lucide-react-native'
import { Transaction, PublicKey } from '@solana/web3.js'
import { Buffer } from 'buffer'
import { spacing, radius } from '@/theme/tokens'
import { ScreenContainer } from '@/components/ui/ScreenContainer'
import { Text } from '@/components/ui/Text'
import { IconButton } from '@/components/ui/IconButton'
import { Avatar } from '@/components/ui/Avatar'
import { Card } from '@/components/ui/Card'
import { MoneyText } from '@/components/ui/MoneyText'
import { Divider } from '@/components/ui/Divider'
import { Spacer } from '@/components/ui/Spacer'
import { EmptyState } from '@/components/ui/EmptyState'
import { showToast } from '@/components/ui/Toast'
import { GigStatusBadge } from '@/components/gig'
import { TransactionMonitor } from '@/components/feedback/TransactionMonitor'
import { LoadingScreen } from '@/components/feedback/LoadingScreen'
import { ErrorState } from '@/components/feedback/ErrorState'
import { GigCTABar } from './_components/GigCTABar'
import { GigActionSheets } from './_components/GigActionSheets'
import { getCategoryColor, CATEGORY_META } from '@/data/mock'
import { useAuthStore } from '@/stores/auth.store'
import { useGigsStore } from '@/stores/gigs.store'
import { usePendingSyncStore } from '@/stores/pending-sync.store'
import { useExchangeRateStore } from '@/stores/exchange-rate.store'
import { toPaymentDisplay } from '@/lib/currency'
import { computeRelevantDeadline, computePlatformFee, SOLANA_TX_FEE_LAMPORTS } from '@tenda/shared'
import { deadlineLabel } from '@/lib/gig-display'
import { api } from '@/api/client'
import { signAndSendTransactionWithWallet, getBalance } from '@/wallet'
import type { ColorScheme } from '@/theme/tokens'
import type { GigDetail } from '@tenda/shared'
import type { ActiveSheet } from './_components/GigCTABar'

type PendingAction =
  | { type: 'publish' }
  | { type: 'accept' }
  | { type: 'approve' }
  | { type: 'cancel' }
  | { type: 'refund' }
  | { type: 'submit'; proofs: Array<{ url: string; type: 'image' | 'video' | 'document' }> }

function formatDate(date: Date | string | null | undefined): string {
  if (!date) return ''
  return new Date(date).toLocaleDateString('en-NG', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

function formatDuration(seconds: number): string {
  if (seconds < 3600) return `${Math.round(seconds / 60)}m`
  if (seconds < 86400) return `${Math.round(seconds / 3600)}h`
  return `${Math.round(seconds / 86400)}d`
}

// ─── Inner component (receives non-null gig) ─────────────────────────────────

function GigDetailContent({ gig, userId }: { gig: GigDetail; userId: string }) {
  const router = useRouter()
  const { theme } = useUnistyles()
  const mwaAuthToken = useAuthStore((s) => s.mwaAuthToken)
  const { fetchGigDetail, acceptGig, submitProof } = useGigsStore()
  const pendingSync = usePendingSyncStore()
  const solToNgn = useExchangeRateStore((s) => s.solToNgn)

  const [activeSheet, setActiveSheet] = useState<ActiveSheet | null>(null)
  const [reviewSubmitted, setReviewSubmitted] = useState(false)
  const [pendingSignature, setPendingSignature] = useState<string | null>(null)
  const [pendingSyncId, setPendingSyncId] = useState<string | null>(null)
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null)

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

  // ── Shared: sign tx and enter monitoring state ──────────────────────────────

  async function startBlockchainFlow(
    action: PendingAction,
    txBase64: string,
    syncAction?: 'publish' | 'approve' | 'cancel' | 'accept' | 'refund',
  ) {
    if (!mwaAuthToken) return
    const tx = Transaction.from(Buffer.from(txBase64, 'base64'))
    const sig = await signAndSendTransactionWithWallet(tx as any, mwaAuthToken)
    if (syncAction) {
      const syncId = pendingSync.add({ gigId: gig.id, action: syncAction, signature: sig })
      setPendingSyncId(syncId)
    }
    setPendingAction(action)
    setPendingSignature(sig)
  }

  // ── Blockchain handlers ────────────────────────────────────────────────────

  async function handlePublish() {
    if (!mwaAuthToken) return
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
    }
  }

  async function handleAccept() {
    if (!mwaAuthToken) return
    try {
      const { transaction } = await api.blockchain.acceptGig({ gig_id: gig.id })
      await startBlockchainFlow({ type: 'accept' }, transaction, 'accept')
    } catch (e) {
      showToast('error', (e as Error).message || 'Failed to build accept transaction')
    }
  }

  async function handleApprove() {
    if (!mwaAuthToken) return
    try {
      const { transaction } = await api.blockchain.approveEscrow({ gig_id: gig.id })
      await startBlockchainFlow({ type: 'approve' }, transaction, 'approve')
    } catch (e) {
      showToast('error', (e as Error).message || 'Failed to build approve transaction')
    }
  }

  async function handleCancelOpen() {
    if (!mwaAuthToken) return
    try {
      const { transaction } = await api.blockchain.cancelEscrow({ gig_id: gig.id })
      await startBlockchainFlow({ type: 'cancel' }, transaction, 'cancel')
    } catch (e) {
      showToast('error', (e as Error).message || 'Failed to build cancel transaction')
    }
  }

  async function handleRefundExpired() {
    if (!mwaAuthToken) return
    try {
      const { transaction } = await api.blockchain.refundExpired({ gig_id: gig.id })
      await startBlockchainFlow({ type: 'refund' }, transaction, 'refund')
    } catch (e) {
      showToast('error', (e as Error).message || 'Failed to build refund transaction')
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
      const sig = await signAndSendTransactionWithWallet(tx as any, mwaAuthToken)
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
    <ScreenContainer scroll={false} padding={false} edges={['top', 'left', 'right', 'bottom']}>
      {/* Top bar */}
      <View style={[s.topBar, { borderBottomColor: theme.colors.borderFaint }]}>
        <IconButton
          icon={<ArrowLeft size={22} color={theme.colors.text} />}
          onPress={() => router.back()}
          variant="ghost"
        />
        <IconButton
          icon={<Share2 size={20} color={theme.colors.text} />}
          onPress={() => {}}
          variant="ghost"
        />
      </View>

      <ScrollView
        style={s.flex}
        contentContainerStyle={s.content}
        showsVerticalScrollIndicator={false}
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
        <MoneyText naira={price.naira} sol={price.sol} size={32} />
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
                Accept by {formatDate(gig.accept_deadline)}
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
            <View>
              <Text variant="body" weight="semibold">{posterName}</Text>
              <Text variant="caption" color={theme.colors.textSub}>
                {gig.poster.reputation_score ?? 0} reputation
              </Text>
            </View>
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
                <View>
                  <Text variant="body" weight="semibold">{workerName}</Text>
                  <Text variant="caption" color={theme.colors.textSub}>
                    {gig.worker.reputation_score ?? 0} reputation
                  </Text>
                </View>
              </View>
            </Card>
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
                <View key={proof.id} style={[s.proofItem, { backgroundColor: theme.colors.muted }]}>
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
                </View>
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
        reviewSubmitted={reviewSubmitted}
        txInProgress={pendingSignature !== null}
        onAction={setActiveSheet}
        onPublish={handlePublish}
        onApprove={handleApprove}
        onRefundExpired={handleRefundExpired}
      />

      <GigActionSheets
        gig={gig}
        activeSheet={activeSheet}
        onClose={() => setActiveSheet(null)}
        onReviewSubmitted={() => setReviewSubmitted(true)}
        onAcceptConfirmed={handleAccept}
        onCancelOpenConfirmed={handleCancelOpen}
        onProofsReady={handleProofsReady}
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
    </ScreenContainer>
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

  if (isLoading && !selectedGig) return <LoadingScreen />

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
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderBottomWidth: 1,
  },
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
  disputeBlock: {
    borderRadius: radius.md,
    padding: spacing.md,
  },
})
