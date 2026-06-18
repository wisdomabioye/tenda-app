import { useState, useEffect } from 'react'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { ScreenContainer } from '@/components/ui/ScreenContainer'
import { Header } from '@/components/ui'
import { RestrictionBanner } from '@/components/reputation'
import { showToast } from '@/components/ui/Toast'
import { GigForm } from '@/components/gig/GigForm'
import { NudgeSheet } from '@/components/onboarding/NudgeSheet'
import { LoadingScreen } from '@/components/feedback/LoadingScreen'
import { useOnboardingStore } from '@/stores/onboarding.store'
import { api, ApiClientError } from '@/api/client'
import { coerceCityForCountry, ErrorCode } from '@tenda/shared'
import { signSendAndReport } from '@/wallet/dispatch'
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
  // Tab screens retain params across visits — '' (cleared) reads as absent.
  const draftId = params.draftId !== undefined && params.draftId !== '' ? params.draftId : undefined
  const [isLoading, setIsLoading] = useState(false)
  const [showNudge, setShowNudge] = useState(false)
  const [blockedMessage, setBlockedMessage] = useState<string | null>(null)
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
        if (!cancelled) showToast('info', 'Could not load the draft — starting fresh')
      } finally {
        if (!cancelled) setDraftLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [draftId])

  // v2 create chain (cutover §6): 1) draft escrow + unsigned create tx,
  // 2) attach gig_details (Stage-6 moderation gate — a block deletes the
  // orphan draft), 3) wallet signs + broadcasts + client-pings. The gig
  // goes live (draft → open) when the verify pipeline confirms the tx.
  async function handleSubmit(values: GigFormValues) {
    if (!values.category) return
    const safeCity = coerceCityForCountry(values.country, values.city)
    if (!values.remote && (!values.country || !safeCity)) return

    // CO5: chain + USDC asset come from the form's picker (policy pair
    // from the shared GIG_ASSET_BY_CHAIN map — the server re-asserts it).
    const chain_id = values.chainId
    const asset = values.asset
    const accept_deadline_unix = Math.floor(
      (Date.now() + values.acceptDeadlineHours * 3_600_000) / 1000,
    )

    setIsLoading(true)
    let escrow_id: string | null = null
    try {
      const created = await api.escrows.create({
        kind: 'gig',
        chain_id,
        asset,
        amount_raw: String(values.paymentRaw),
        accept_deadline_unix,
        completion_duration_seconds: values.completionDuration,
      })
      escrow_id = created.escrow_id

      try {
        await api.gigs.create({
          escrow_id: created.escrow_id,
          title: values.title.trim(),
          description: values.description.trim() || undefined,
          category: values.category,
          country: values.country ?? undefined,
          remote: values.remote,
          city: safeCity || undefined,
        })
      } catch (e) {
        // Stage-6 block (or validation failure): the chain-agnostic draft
        // would be an orphan — discard it before surfacing the error.
        await api.escrows.delete({ id: created.escrow_id }).catch(() => {})
        escrow_id = null
        throw e
      }

      // Retry-from-draft: the listing now lives on the NEW draft — discard
      // the abandoned one. A 409 (its create tx is still pending) leaves it
      // alone; it stays deletable from its own page.
      if (draftId !== undefined && draftId !== created.escrow_id) {
        await api.escrows.delete({ id: draftId }).catch(() => {})
      }

      await signSendAndReport({
        unsigned: created.unsigned,
        action: 'create',
        chain_id,
        escrow_id: created.escrow_id,
      })

      showToast('success', 'Gig submitted! It goes live once the escrow confirms.')
      // Clear the retry param so the next visit to this tab starts blank.
      if (draftId !== undefined) {
        setDraftValues(null)
        router.setParams({ draftId: '' })
      }
      router.navigate('/(tabs)/home' as any)
      router.push(`/gig/${created.escrow_id}` as any)
    } catch (e) {
      // 9D first-transaction gate: route to link-wallet / verify-contact.
      // It surfaces from escrows.create() before escrow_id is set, so there
      // is no orphan draft to clean up here.
      const gate = classifyTransactionGateError(e)
      if (gate !== null) {
        showToast('error', TRANSACTION_GATE_MESSAGE[gate])
        router.push(transactionGateRoute(gate))
      } else if (e instanceof ApiClientError && e.code === ErrorCode.CONTENT_MODERATED) {
        // Stage-6: block verdicts get the full dialog — no retry path.
        setBlockedMessage(e.message)
      } else if (escrow_id !== null) {
        // Details saved but signing failed/declined — the draft survives
        // with a Delete Draft CTA on its page.
        showToast('info', e instanceof Error ? e.message : 'Signing incomplete — draft saved')
        router.push(`/gig/${escrow_id}` as any)
      } else {
        showToast('error', e instanceof Error ? e.message : 'Failed to create gig')
      }
    } finally {
      setIsLoading(false)
    }
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
            // Remount when the prefill arrives — GigForm seeds its state once.
            key={draftValues !== null ? draftId : 'blank'}
            initialValues={draftValues ?? undefined}
            submitLabel={draftId !== undefined ? 'Repost Gig' : 'Post Gig'}
            onSubmit={handleSubmit}
            isLoading={isLoading}
          />
        )}
      </ScreenContainer>
      <ModerationBlockedDialog
        visible={blockedMessage !== null}
        message={blockedMessage ?? ''}
        onEdit={() => setBlockedMessage(null)}
      />
    </>
  )
}
