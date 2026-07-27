/**
 * The poster's applicant shortlist for one approval-mode gig, and the assign
 * transaction that ends it.
 *
 * A screen of its own rather than a section of the gig detail: assigning is a
 * wallet-opening decision made by comparing people, and it needs the room. The
 * transaction rides the same gate every other transition does — TxConfirmDialog
 * before the wallet, TransactionMonitor until it confirms — so a worker is
 * never assigned by a single ambiguous tap.
 */
import { useCallback, useState } from 'react'
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router'
import { formatAssetAmount, canAssign, type GigApplicant, type GigDetail } from '@tenda/shared'
import { ScreenContainer, Header, showToast } from '@/components/ui'
import { TransactionMonitor } from '@/components/feedback'
import { TxConfirmDialog, TX_PROGRESS_LABEL, txSuccessCopy } from '@/components/escrow'
import { GigDetailGate } from '@/components/gig'
import { ApplicantList, useApplicantList, type ApplicantFilter } from '@/components/gig/gig-applications'
import { useEscrowActions } from '@/hooks/useEscrowActions'
import { useGigsStore } from '@/stores'
import { formatDuration } from '@/lib/gig-display'

function ApplicantsContent({ gig, userId }: { gig: GigDetail; userId: string }) {
  const router = useRouter()
  const { fetchGigDetail } = useGigsStore()
  const [filter, setFilter] = useState<ApplicantFilter>('open')
  const [pending, setPending] = useState<GigApplicant | null>(null)

  const { applicants, error, load } = useApplicantList(gig.escrow_id, filter)
  const actions = useEscrowActions({
    escrowId: gig.escrow_id,
    chainId: gig.chain_id,
    asset: gig.asset,
    amountRaw: gig.amount_raw,
  })

  // Reload on focus AND whenever the filter changes: coming back from a
  // confirmed assignment must not leave the shortlist showing everyone as
  // still waiting.
  useFocusEffect(
    useCallback(() => {
      void load()
    }, [load]),
  )

  // One shared rule for the whole screen, from the shared helper — so the
  // rows, the gate and the server cannot disagree about whether this gig can
  // still be assigned.
  const assignable = canAssign(
    {
      status: gig.status,
      creator_id: gig.creator.id,
      counterparty_id: gig.counterparty?.id ?? null,
      requires_approval: gig.requires_approval,
      assigned_counterparty_id: gig.assigned_counterparty_id,
      accept_deadline: gig.accept_deadline,
    },
    userId,
  )

  function handleConfirmed() {
    const action = actions.pendingAction
    actions.clearPending()
    if (action !== null) showToast('success', txSuccessCopy(action, 'gig'))
    void fetchGigDetail(gig.escrow_id)
    // The gig is no longer open, so the shortlist is history now — the detail
    // screen is where the poster tracks the work from here.
    router.back()
  }

  return (
    <ScreenContainer scroll={false} padding={false} edges={['left', 'right', 'bottom']}>
      <Header title="Applicants" showBack />

      <ApplicantList
        applicants={applicants}
        error={error}
        filter={filter}
        onFilterChange={setFilter}
        assignable={assignable}
        busy={actions.busyAction !== null || actions.pendingTxRef !== null}
        onAssign={setPending}
      />

      <TxConfirmDialog
        action={pending !== null ? 'assign_accept' : null}
        ctx={{
          amount: formatAssetAmount(gig.amount_raw, gig.asset),
          kind: 'gig',
          deliverWithin:
            gig.completion_duration_seconds != null
              ? formatDuration(gig.completion_duration_seconds)
              : null,
        }}
        onConfirm={() => {
          const applicant = pending
          setPending(null)
          if (applicant !== null) void actions.assign(applicant.applicant_id)
        }}
        onCancel={() => setPending(null)}
      />

      <TransactionMonitor
        signature={actions.pendingTxRef}
        phase={actions.phase}
        actionLabel={
          actions.activeAction !== null ? TX_PROGRESS_LABEL[actions.activeAction] : undefined
        }
        escrowId={gig.escrow_id}
        chainId={gig.chain_id}
        onConfirmed={handleConfirmed}
        onFailed={(msg) => {
          actions.clearPending()
          showToast('info', msg || 'Transaction pending, will sync when confirmed')
          void load()
        }}
      />
    </ScreenContainer>
  )
}

export default function ApplicantsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  // Creator-gated: the shortlist route is poster-only server-side, so anyone
  // else would be looking at a screen whose every request 403s.
  return (
    <GigDetailGate id={id} requireCreator>
      {(gig, userId) => <ApplicantsContent gig={gig} userId={userId} />}
    </GigDetailGate>
  )
}
