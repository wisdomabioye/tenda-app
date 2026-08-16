'use client'

/**
 * The authed half of /gig/[id] — web port of mobile's gig detail screen
 * content. The SSR page renders the anonymous listing; this island, once a
 * session exists, refetches the SAME endpoint with the bearer (adding the
 * party-scoped half: viewer block, counterparty, proofs, hidden flag) and
 * renders the CTA bar + tx gate + monitors + input dialogs. Anonymous
 * visitors keep the sign-in CTA.
 */
import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  TX_PROGRESS_LABEL,
  checkEscrowTransitionApplied,
  formatAssetAmount,
  formatDuration,
  txSuccessCopy,
  type ActiveSheet,
  type EscrowTxType,
  type GigDetail,
} from '@tenda/shared'
import { api } from '@/api/client'
import { useAuthStore } from '@/stores/auth.store'
import { useGigsStore } from '@/stores/gigs.store'
import { useEscrowActions, type ProofFile } from '@/hooks/escrow/useEscrowActions'
import { useEscrowLiveRefresh } from '@/hooks/escrow/live'
import { useEscrowFee } from '@/hooks/escrow/useEscrowFee'
import { useGigApprovalFlow } from '@/components/gig/gig-applications'
import { showToast } from '@/components/ui/Toast'
import { ConfirmDialog } from '@/components/ui/overlay/ConfirmDialog'
import { TxConfirmDialog } from '@/components/escrow/TxConfirmDialog'
import { TransactionMonitor } from '@/components/escrow/TransactionMonitor'
import { GigDetailCta, type PublicGigCta } from '@/components/gig/GigDetailCta'
import { GigCTABar } from './GigCTABar'
import { GigActionDialogs } from './action-dialogs'
import { ApplyDialog } from '@/components/gig/gig-applications'
import { PartyPanel } from './PartyPanel'
import { TakedownNotice } from './TakedownNotice'

export function GigDetailAuthed({ gig, userId }: { gig: GigDetail; userId: string }) {
  const router = useRouter()
  const fetchGigDetail = useGigsStore((s) => s.fetchGigDetail)

  const [activeSheet, setActiveSheet] = useState<ActiveSheet | null>(null)
  const [confirmAction, setConfirmAction] = useState<EscrowTxType | null>(null)

  const actions = useEscrowActions({
    escrowId: gig.escrow_id,
    chainId: gig.chain_id,
    asset: gig.asset,
    amountRaw: gig.amount_raw,
    // Refused as taken down: re-read so the bar stops offering what the
    // server has just declined.
    onStale: () => void fetchGigDetail(gig.escrow_id),
  })

  // Worker-net projection for the confirm dialogs (approve/claim quote what
  // is actually credited — the escrow's fee tier, live platform bps).
  const { netRaw, feePct } = useEscrowFee(gig.is_seeker, gig.amount_raw)

  const approval = useGigApprovalFlow({
    escrowId: gig.escrow_id,
    onChanged: () => void fetchGigDetail(gig.escrow_id),
    onRequestUnassign: () => setConfirmAction('unassign'),
  })

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
      case 'unassign': return void actions.unassign()
      case 'decline': return void actions.decline()
    }
  }

  function handleTransactionConfirmed() {
    const action = actions.pendingAction
    actions.clearPending()
    if (action !== null) {
      showToast('success', txSuccessCopy(action, 'gig'))
    }
    if (action === 'cancel') {
      router.push('/my-gigs')
    } else {
      void fetchGigDetail(gig.escrow_id)
    }
  }

  // Sheet-confirmed handlers (dialogs collect input; the hook signs).
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
    <div className="flex flex-col gap-4">
      <TakedownNotice escrow={gig} subject="gig" viewerId={userId} />
      <PartyPanel gig={gig} userId={userId} />

      <GigCTABar
        gig={gig}
        userId={userId}
        isTxBuilding={actions.busyAction !== null}
        txInProgress={actions.pendingTxRef !== null}
        onAction={setActiveSheet}
        onTxAction={setConfirmAction}
        onApprovalAction={approval.handleAction}
        onRetryDraft={() => router.push(`/post?draftId=${gig.escrow_id}`)}
      />

      <TxConfirmDialog
        action={confirmAction}
        ctx={{
          amount: formatAssetAmount(gig.amount_raw, gig.asset),
          kind: 'gig',
          deliverWithin:
            gig.completion_duration_seconds != null
              ? formatDuration(gig.completion_duration_seconds)
              : null,
          netAmount: netRaw !== null ? formatAssetAmount(netRaw.toString(), gig.asset) : null,
          feePct,
        }}
        onConfirm={runConfirmedAction}
        onCancel={() => setConfirmAction(null)}
      />

      <GigActionDialogs
        gig={gig}
        activeSheet={activeSheet}
        onClose={() => setActiveSheet(null)}
        onReviewSubmitted={() => void fetchGigDetail(gig.escrow_id)}
        onProofsReady={handleProofsReady}
        onAddProofsReady={handleAddProofsReady}
        onDisputeReady={handleDisputeReady}
      />

      {(actions.phase !== 'idle' || actions.pendingTxRef !== null) && (
        <TransactionMonitor
          signature={actions.pendingTxRef}
          phase={actions.phase}
          actionLabel={actions.activeAction !== null ? TX_PROGRESS_LABEL[actions.activeAction] : undefined}
          escrowId={gig.escrow_id}
          chainId={gig.chain_id}
          checkApplied={() =>
            checkEscrowTransitionApplied(actions.pendingAction, () => api.gigs.get({ id: gig.escrow_id }))
          }
          onConfirmed={handleTransactionConfirmed}
          onFailed={(msg) => {
            actions.clearPending()
            showToast('info', msg || 'Transaction pending, will sync when confirmed')
          }}
        />
      )}

      <ApplyDialog
        open={approval.applyOpen}
        busy={approval.busy}
        onClose={approval.closeApply}
        onSubmit={approval.apply}
      />

      {/* Off-chain confirms use the styled ConfirmDialog, never window.confirm
          and never TxConfirmDialog — no wallet opens, so promising one would
          be a lie. */}
      <ConfirmDialog {...approval.confirmDialog} />
    </div>
  )
}

/**
 * Session-aware wrapper. The SSR/anonymous render is the sign-in CTA (what
 * the server sent); once a session loads, the bearer refetch swaps in the
 * party-scoped detail. `gone` after a refetch (deleted / taken down for this
 * viewer) drops the detail, so the island renders nothing and the page keeps
 * only the static SSR listing — no dead action buttons, no anonymous CTA
 * flashing at a signed-in user.
 */
export interface PublicGigInitial extends PublicGigCta {
  escrow_id: string
}

export function GigDetailApp({ initial }: { initial: PublicGigInitial }) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const userId = useAuthStore((s) => s.user?.id ?? null)
  const loadSession = useAuthStore((s) => s.loadSession)
  const isLoading = useAuthStore((s) => s.isLoading)
  const selectedGig = useGigsStore((s) => s.selectedGig)
  const fetchGigDetail = useGigsStore((s) => s.fetchGigDetail)

  // The public page mounts outside the authed layout, so bootstrap the
  // session here (idempotent — resolves from the stored token).
  useEffect(() => {
    if (isLoading) void loadSession()
  }, [isLoading, loadSession])

  const refetch = useCallback(() => {
    void fetchGigDetail(initial.escrow_id)
  }, [fetchGigDetail, initial.escrow_id])

  useEffect(() => {
    if (isAuthenticated) refetch()
  }, [isAuthenticated, refetch])

  const gig = selectedGig?.escrow_id === initial.escrow_id ? selectedGig : null

  // Live-update when the counterparty acts (accept / submit / approve), not
  // just on load — the escrow WS channel drives the refetch (mobile parity).
  // Inert until the bearer detail lands (escrowId undefined-gated inside).
  useEscrowLiveRefresh(gig?.escrow_id, refetch, gig?.status ?? 'draft')

  if (!isAuthenticated || userId === null) return <GigDetailCta gig={initial} />
  // Authed but the bearer refetch hasn't landed: render nothing rather than
  // the anonymous CTA flashing "Sign in to accept" at a signed-in user.
  if (gig === null) return null
  return <GigDetailAuthed gig={gig} userId={userId} />
}
