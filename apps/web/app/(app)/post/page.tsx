'use client'

/**
 * Post a Gig — web port of mobile's (tabs)/create-gig screen. The form only
 * validates + opens the confirm gate; the funding lifecycle (draft escrow →
 * gig details → sign → monitor) lives in useGigFunding. `?draftId=` prefills
 * from an abandoned draft (CO6 retry-from-draft: recreate fresh and discard
 * the old row — the unsigned create tx is bound to the old escrow id, so
 * in-place editing is impossible by design).
 */
import { Suspense, useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import {
  TX_PROGRESS_LABEL,
  coerceCityForCountry,
  formatAssetAmount,
  DEFAULT_COMPLETION_SECONDS,
  type GigFormValues,
} from '@tenda/shared'
import { api } from '@/api/client'
import { showToast } from '@/components/ui/Toast'
import { Spinner } from '@/components/ui/Spinner'
import { GigForm } from '@/components/gig/GigForm'
import { ModerationBlockedDialog } from '@/components/moderation/ModerationBlockedDialog'
import { TxConfirmDialog } from '@/components/escrow/TxConfirmDialog'
import { TransactionMonitor } from '@/components/escrow/TransactionMonitor'
import { useGigFunding } from '@/hooks/useGigFunding'

function PostGigScreen() {
  const params = useSearchParams()
  const rawDraftId = params.get('draftId')
  const draftId = rawDraftId !== null && rawDraftId !== '' ? rawDraftId : undefined
  // CO6 "retry from draft": prefill from an abandoned draft, then recreate
  // fresh and discard the old row.
  const [draftValues, setDraftValues] = useState<Partial<GigFormValues> | null>(null)
  const [draftLoading, setDraftLoading] = useState(draftId !== undefined)
  // Bumped when a composed gig has been committed to the server, forcing a
  // fresh blank form (GigForm seeds its state once per mount key).
  const [composerGeneration, setComposerGeneration] = useState(0)

  const funding = useGigFunding({
    draftId,
    resetForm: () => {
      setDraftValues(null)
      setComposerGeneration((n) => n + 1)
    },
  })

  useEffect(() => {
    if (draftId === undefined) return
    let cancelled = false
    void (async () => {
      try {
        const draft = await api.gigs.get({ id: draftId })
        if (cancelled) return
        setDraftValues({
          title: draft.title,
          description: draft.description ?? '',
          chainId: draft.chain_id,
          asset: draft.asset,
          paymentRaw: Number(draft.amount_raw),
          completionDuration: draft.completion_duration_seconds ?? DEFAULT_COMPLETION_SECONDS,
          category: draft.category,
          country: draft.country,
          remote: draft.remote,
          city: draft.city,
          proofRequirements: draft.proof_requirements,
          requiresApproval: draft.requires_approval,
        })
      } catch {
        if (!cancelled) showToast('info', 'Could not load the draft, starting fresh')
      } finally {
        if (!cancelled) setDraftLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [draftId])

  // Form submit only validates + opens the confirm gate (the pre-sign step
  // that tells the user funding locks their money and the wallet will open).
  async function handleFormSubmit(values: GigFormValues) {
    if (!values.category) return
    const safeCity = coerceCityForCountry(values.country, values.city)
    if (!values.remote && (!values.country || !safeCity)) return
    funding.setPendingValues(values)
  }

  const { pendingValues } = funding

  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-8">
      <h1 className="mb-6 font-display text-2xl font-bold text-content-primary">
        {draftId !== undefined ? 'Edit & repost' : 'Post a gig'}
      </h1>
      {draftLoading ? (
        <div className="flex justify-center py-16">
          <Spinner />
        </div>
      ) : (
        <GigForm
          // Remount when the prefill arrives (GigForm seeds its state once)
          // and when a posted gig retires the previous composer.
          key={`${draftValues !== null ? draftId : 'blank'}:${composerGeneration}`}
          initialValues={draftValues ?? undefined}
          submitLabel={draftId !== undefined ? 'Repost Gig' : 'Post Gig'}
          onSubmit={handleFormSubmit}
          isLoading={funding.phase !== 'idle'}
        />
      )}

      <TxConfirmDialog
        action={pendingValues !== null ? 'create' : null}
        ctx={{
          amount:
            pendingValues !== null
              ? formatAssetAmount(String(pendingValues.paymentRaw), pendingValues.asset)
              : '',
          kind: 'gig',
        }}
        onConfirm={() => void funding.runFunding()}
        onCancel={() => funding.setPendingValues(null)}
      />

      {(funding.phase !== 'idle' || funding.monitor !== null) && (
        <TransactionMonitor
          signature={funding.monitor?.signature ?? null}
          phase={funding.phase}
          actionLabel={TX_PROGRESS_LABEL.create}
          preparingCaption="Reviewing your gig against our guidelines — this takes a few seconds before your wallet opens."
          escrowId={funding.monitor?.escrowId}
          chainId={funding.monitor?.chainId}
          checkApplied={() => funding.checkApplied()}
          onConfirmed={funding.handleFunded}
          onFailed={funding.handleFundTimeout}
        />
      )}

      <ModerationBlockedDialog
        open={funding.blockedMessage !== null}
        message={funding.blockedMessage ?? ''}
        onEdit={funding.dismissBlocked}
      />
    </main>
  )
}

export default function PostGigPage() {
  // useSearchParams needs a Suspense boundary under the app router.
  return (
    <Suspense fallback={null}>
      <PostGigScreen />
    </Suspense>
  )
}
