'use client'

/**
 * The poster's applicant shortlist for one approval-mode gig, and the assign
 * transaction that ends it — web port of mobile's gig/[id]/applicants. The
 * transaction rides the same gate every other transition does:
 * TxConfirmDialog before the wallet, TransactionMonitor until it confirms.
 * Poster-only: the route is enforced server-side, so anyone else just gets a
 * not-available state.
 */
import { use, useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  TX_PROGRESS_LABEL,
  approvalContextOf,
  canAssign,
  checkEscrowTransitionApplied,
  formatAssetAmount,
  formatDuration,
  txSuccessCopy,
  type GigApplicant,
} from '@tenda/shared'
import { api } from '@/api/client'
import { useAuthStore } from '@/stores/auth.store'
import { useGigsStore } from '@/stores/gigs.store'
import { useEscrowActions } from '@/hooks/useEscrowActions'
import { useApplicantList, type ApplicantFilter } from '@/components/gig/gig-applications'
import { showToast } from '@/components/ui/Toast'
import { TxConfirmDialog } from '@/components/escrow/TxConfirmDialog'
import { TransactionMonitor } from '@/components/escrow/TransactionMonitor'
import { TakedownNotice } from '@/components/gig/detail/TakedownNotice'
import { ApplicantList } from '@/components/gig/gig-applications'

export default function ApplicantsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const userId = useAuthStore((s) => s.user?.id ?? '')
  const selectedGig = useGigsStore((s) => s.selectedGig)
  const loadError = useGigsStore((s) => s.error)
  const fetchGigDetail = useGigsStore((s) => s.fetchGigDetail)
  const [filter, setFilter] = useState<ApplicantFilter>('open')
  const [pending, setPending] = useState<GigApplicant | null>(null)

  const gig = selectedGig?.escrow_id === id ? selectedGig : null
  const failure = loadError !== null && loadError.id === id ? loadError : null

  const { applicants, error, load } = useApplicantList(id, filter)

  useEffect(() => {
    void fetchGigDetail(id)
  }, [fetchGigDetail, id])
  useEffect(() => {
    void load()
  }, [load])

  const refreshAll = useCallback(() => {
    void fetchGigDetail(id)
    void load()
  }, [fetchGigDetail, id, load])

  const actions = useEscrowActions({
    escrowId: id,
    chainId: gig?.chain_id ?? '',
    asset: gig?.asset ?? '',
    amountRaw: gig?.amount_raw ?? '0',
    // A takedown stops this screen dead just the same: re-reading the gig
    // clears `assignable`, so the rows stop offering a refused button.
    onStale: () => void fetchGigDetail(id),
  })

  if (gig === null) {
    return (
      <main className="mx-auto w-full max-w-2xl px-4 py-8">
        <p className="py-10 text-center text-sm text-content-secondary">
          {failure !== null ? failure.message : 'Loading…'}
        </p>
      </main>
    )
  }

  if (gig.creator.id !== userId) {
    return (
      <main className="mx-auto w-full max-w-2xl px-4 py-8">
        <p className="py-10 text-center text-sm text-content-secondary">
          Only the poster can see who applied to a gig.
        </p>
      </main>
    )
  }

  // One shared rule for the whole screen — the rows, the gate and the server
  // cannot disagree about whether this gig can still be assigned.
  const assignable = canAssign(approvalContextOf(gig), userId)

  function handleConfirmed() {
    const action = actions.pendingAction
    actions.clearPending()
    if (action !== null) showToast('success', txSuccessCopy(action, 'gig'))
    void fetchGigDetail(id)
    // The gig is no longer open — the detail screen tracks the work from here.
    router.push(`/gig/${id}`)
  }

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-4 px-4 py-8">
      <h1 className="font-display text-2xl font-bold text-content-primary">Applicants</h1>

      <TakedownNotice escrow={gig} subject="gig" viewerId={userId} />

      <ApplicantList
        applicants={applicants}
        error={error}
        filter={filter}
        onFilterChange={setFilter}
        assignable={assignable}
        busy={actions.busyAction !== null || actions.pendingTxRef !== null}
        onAssign={setPending}
        onRetry={refreshAll}
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

      {(actions.phase !== 'idle' || actions.pendingTxRef !== null) && (
        <TransactionMonitor
          signature={actions.pendingTxRef}
          phase={actions.phase}
          actionLabel={
            actions.activeAction !== null ? TX_PROGRESS_LABEL[actions.activeAction] : undefined
          }
          escrowId={id}
          chainId={gig.chain_id}
          checkApplied={() =>
            checkEscrowTransitionApplied(actions.pendingAction, () => api.gigs.get({ id }))
          }
          onConfirmed={handleConfirmed}
          onFailed={(msg) => {
            actions.clearPending()
            showToast('info', msg || 'Transaction pending, will sync when confirmed')
          }}
        />
      )}
    </main>
  )
}
