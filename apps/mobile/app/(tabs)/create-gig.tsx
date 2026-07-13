import { useState, useEffect } from 'react'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { ScreenContainer } from '@/components/ui/ScreenContainer'
import { Header } from '@/components/ui'
import { RestrictionBanner } from '@/components/reputation'
import { showToast } from '@/components/ui/Toast'
import { GigForm } from '@/components/gig/GigForm'
import { NudgeSheet } from '@/components/onboarding/NudgeSheet'
import { LoadingScreen } from '@/components/feedback/LoadingScreen'
import { TransactionMonitor } from '@/components/feedback'
import { TxConfirmDialog, TX_PROGRESS_LABEL } from '@/components/escrow'
import { useOnboardingStore } from '@/stores/onboarding.store'
import { api, ApiClientError } from '@/api/client'
import { coerceCityForCountry, ErrorCode, formatAssetAmount } from '@tenda/shared'
import { signSendAndReport } from '@/wallet/dispatch'
import { buildPermitFor } from '@/wallet/permit'
import type { TxPhase } from '@/hooks/useEscrowActions'
import {
  classifyTransactionGateError,
  TRANSACTION_GATE_MESSAGE,
  transactionGateRoute,
} from '@/lib/transaction-gate'
import { ModerationBlockedDialog } from '@/components/moderation/ModerationBlockedDialog'
import type { GigFormValues } from '@/components/gig/GigForm'

export default function PostGigScreen() {
  const router = useRouter()
  const params = useLocalSearchParams<{ draftId?: string }>()
  // Tab screens retain params across visits, '' (cleared) reads as absent.
  const draftId = params.draftId !== undefined && params.draftId !== '' ? params.draftId : undefined
  const [showNudge, setShowNudge] = useState(false)
  const [blockedMessage, setBlockedMessage] = useState<string | null>(null)
  // Confirm gate → funding lifecycle. pendingValues drives the confirm dialog;
  // once confirmed, phase + signature drive the shared progress modal, which
  // holds until the escrow confirms on-chain (then we navigate).
  const [pendingValues, setPendingValues] = useState<GigFormValues | null>(null)
  const [phase, setPhase] = useState<TxPhase>('idle')
  const [monitor, setMonitor] = useState<{ signature: string; escrowId: string; chainId: string } | null>(null)
  // CO6 "retry from draft": prefill from an abandoned draft, then recreate
  // fresh and discard the old row (the unsigned create tx is bound to the
  // old escrow id, so in-place editing is impossible by design).
  const [draftValues, setDraftValues] = useState<Partial<GigFormValues> | null>(null)
  const [draftLoading, setDraftLoading] = useState(draftId !== undefined)
  const { dismissedNudges } = useOnboardingStore()

  useEffect(() => {
    if (!dismissedNudges.post) setShowNudge(true)
  }, [dismissedNudges.post])

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
          completionDuration: draft.completion_duration_seconds ?? 86_400,
          category: draft.category,
          country: draft.country,
          remote: draft.remote,
          city: draft.city,
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
  // async only to satisfy GigForm's Promise<void> onSubmit contract.
  async function handleFormSubmit(values: GigFormValues) {
    if (!values.category) return
    const safeCity = coerceCityForCountry(values.country, values.city)
    if (!values.remote && (!values.country || !safeCity)) return
    setPendingValues(values)
  }

  // Confirmed → v2 create chain (cutover §6): 1) draft escrow + unsigned
  // create tx, 2) attach gig_details (Stage-6 moderation gate, a block deletes
  // the orphan draft), 3) wallet signs + broadcasts + client-pings. The gig
  // goes live (draft → open) when the verify pipeline confirms the tx; the
  // progress modal holds until then (handleFunded).
  async function runFunding() {
    if (pendingValues === null || !pendingValues.category) return
    const values = pendingValues
    const category = pendingValues.category
    setPendingValues(null)

    const safeCity = coerceCityForCountry(values.country, values.city)
    // CO5: chain + USDC asset come from the form's picker (policy pair
    // from the shared gigAssetByChain helper, the server re-asserts it).
    const chain_id = values.chainId
    const asset = values.asset
    const accept_deadline_unix = Math.floor(
      (Date.now() + values.acceptDeadlineHours * 3_600_000) / 1000,
    )

    setPhase('preparing')
    let escrow_id: string | null = null
    try {
      // EIP-2612: sign the allowance BEFORE creating so it rides the create
      // tx (undefined = approve fallback via the unsigned tx's approval hint).
      const permit = await buildPermitFor({
        chain_id,
        asset,
        value_raw: String(values.paymentRaw),
      })
      const created = await api.escrows.create({
        kind: 'gig',
        chain_id,
        asset,
        amount_raw: String(values.paymentRaw),
        accept_deadline_unix,
        completion_duration_seconds: values.completionDuration,
        ...(permit !== undefined ? { permit } : {}),
      })
      escrow_id = created.escrow_id

      try {
        await api.gigs.create({
          escrow_id: created.escrow_id,
          title: values.title.trim(),
          description: values.description.trim() || undefined,
          category,
          country: values.country ?? undefined,
          remote: values.remote,
          city: safeCity || undefined,
        })
      } catch (e) {
        // Stage-6 block (or validation failure): the chain-agnostic draft
        // would be an orphan, discard it before surfacing the error.
        await api.escrows.delete({ id: created.escrow_id }).catch(() => {})
        escrow_id = null
        throw e
      }

      // Retry-from-draft: the listing now lives on the NEW draft, discard
      // the abandoned one. A 409 (its create tx is still pending) leaves it
      // alone; it stays deletable from its own page.
      if (draftId !== undefined && draftId !== created.escrow_id) {
        await api.escrows.delete({ id: draftId }).catch(() => {})
      }

      setPhase('signing')
      const tx_ref = await signSendAndReport({
        unsigned: created.unsigned,
        action: 'create',
        chain_id,
        escrow_id: created.escrow_id,
      })

      // Hold the progress modal on-chain-confirm instead of navigating away
      // blind (the newcomer's "did it work?" gap).
      setPhase('confirming')
      setMonitor({ signature: tx_ref, escrowId: created.escrow_id, chainId: chain_id })
    } catch (e) {
      setPhase('idle')
      // 9D first-transaction gate: route to link-wallet / verify-contact.
      // It surfaces from escrows.create() before escrow_id is set, so there
      // is no orphan draft to clean up here.
      const gate = classifyTransactionGateError(e)
      if (gate !== null) {
        showToast('error', TRANSACTION_GATE_MESSAGE[gate])
        router.push(transactionGateRoute(gate))
      } else if (e instanceof ApiClientError && e.code === ErrorCode.CONTENT_MODERATED) {
        // Stage-6: block verdicts get the full dialog, no retry path.
        setBlockedMessage(e.message)
      } else if (escrow_id !== null) {
        // Details saved but signing failed/declined, the draft survives
        // with a Delete Draft CTA on its page.
        showToast('info', e instanceof Error ? e.message : 'Signing incomplete, draft saved')
        router.push(`/gig/${escrow_id}`)
      } else {
        showToast('error', e instanceof Error ? e.message : 'Failed to create gig')
      }
    }
  }

  // Tear down the progress modal, clear the retry-draft param, and land on the
  // gig's page. Shared by the confirmed and timed-out exits (they differ only
  // in the toast).
  function leaveAfterFunding(type: 'success' | 'info', message: string) {
    const escrowId = monitor?.escrowId
    setMonitor(null)
    setPhase('idle')
    showToast(type, message)
    if (draftId !== undefined) {
      setDraftValues(null)
      router.setParams({ draftId: '' })
    }
    router.navigate('/(tabs)/home')
    if (escrowId !== undefined) router.push(`/gig/${escrowId}`)
  }

  // Escrow confirmed on-chain → the gig is live.
  function handleFunded() {
    leaveAfterFunding('success', 'Gig funded and live!')
  }

  // Timed out / soft failure: the escrow will sync when it confirms; land on
  // the gig page (draft or live) rather than trapping the user in the modal.
  function handleFundTimeout(msg: string) {
    leaveAfterFunding('info', msg || 'Submitted — it will go live once the escrow confirms.')
  }

  return (
    <>
      <NudgeSheet
        visible={showNudge}
        nudgeKey="post"
        title="Posting your first gig"
        body="Your payment is locked upfront in escrow, workers only see confirmed gigs with guaranteed funds. You approve the work before anyone gets paid."
        guideRoute="/(support)/posting"
        onClose={() => setShowNudge(false)}
      />
      <ScreenContainer scroll={false} padding={false} edges={['left', 'right']}>
        <Header title={draftId !== undefined ? 'Edit & repost' : 'Post a gig'} showBack />
        <RestrictionBanner />
        {draftLoading ? (
          <LoadingScreen />
        ) : (
          <GigForm
            // Remount when the prefill arrives, GigForm seeds its state once.
            key={draftValues !== null ? draftId : 'blank'}
            initialValues={draftValues ?? undefined}
            submitLabel={draftId !== undefined ? 'Repost Gig' : 'Post Gig'}
            onSubmit={handleFormSubmit}
            isLoading={phase !== 'idle'}
          />
        )}
      </ScreenContainer>

      <TxConfirmDialog
        action={pendingValues !== null ? 'create' : null}
        ctx={{
          amount: pendingValues !== null ? formatAssetAmount(String(pendingValues.paymentRaw), pendingValues.asset) : '',
          kind: 'gig',
        }}
        onConfirm={() => void runFunding()}
        onCancel={() => setPendingValues(null)}
      />

      <TransactionMonitor
        signature={monitor?.signature ?? null}
        phase={phase}
        actionLabel={TX_PROGRESS_LABEL.create}
        preparingCaption="Reviewing your gig against our guidelines — this takes a few seconds before your wallet opens."
        escrowId={monitor?.escrowId}
        chainId={monitor?.chainId}
        onConfirmed={handleFunded}
        onFailed={handleFundTimeout}
      />

      <ModerationBlockedDialog
        visible={blockedMessage !== null}
        message={blockedMessage ?? ''}
        onEdit={() => setBlockedMessage(null)}
      />
    </>
  )
}
