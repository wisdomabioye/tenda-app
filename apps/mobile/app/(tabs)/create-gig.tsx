import { useState, useEffect } from 'react'
import { useRouter } from 'expo-router'
import { ScreenContainer } from '@/components/ui/ScreenContainer'
import { Header } from '@/components/ui'
import { RestrictionBanner } from '@/components/reputation'
import { showToast } from '@/components/ui/Toast'
import { GigForm } from '@/components/gig/GigForm'
import { NudgeSheet } from '@/components/onboarding/NudgeSheet'
import { useOnboardingStore } from '@/stores/onboarding.store'
import { api, ApiClientError } from '@/api/client'
import {
  coerceCityForCountry,
  solanaChainId,
  solanaNativeAssetId,
  ErrorCode,
} from '@tenda/shared'
import { APP_IDENTITY } from '@/wallet'
import { signSendAndReport } from '@/wallet/dispatch'
import { ModerationBlockedDialog } from '@/components/moderation/ModerationBlockedDialog'
import type { GigFormValues } from '@/components/gig/GigForm'

export default function PostGigScreen() {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)
  const [showNudge, setShowNudge] = useState(false)
  const [blockedMessage, setBlockedMessage] = useState<string | null>(null)
  const { dismissedNudges } = useOnboardingStore()

  useEffect(() => {
    if (!dismissedNudges.post) setShowNudge(true)
  }, [])

  // v2 create chain (cutover §6): 1) draft escrow + unsigned create tx,
  // 2) attach gig_details (Stage-6 moderation gate — a block deletes the
  // orphan draft), 3) wallet signs + broadcasts + client-pings. The gig
  // goes live (draft → open) when the verify pipeline confirms the tx.
  async function handleSubmit(values: GigFormValues) {
    if (!values.category) return
    const safeCity = coerceCityForCountry(values.country, values.city)
    if (!values.remote && (!values.country || !safeCity)) return

    const chain_id = solanaChainId(APP_IDENTITY.network)
    const asset = solanaNativeAssetId(APP_IDENTITY.network)
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
        amount_raw: String(values.paymentLamports),
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

      await signSendAndReport({
        unsigned: created.unsigned,
        action: 'create',
        chain_id,
        escrow_id: created.escrow_id,
      })

      showToast('success', 'Gig submitted! It goes live once the escrow confirms.')
      router.navigate('/(tabs)/home' as any)
      router.push(`/gig/${created.escrow_id}` as any)
    } catch (e) {
      // Stage-6: block verdicts get the full dialog — no retry path.
      if (e instanceof ApiClientError && e.code === ErrorCode.CONTENT_MODERATED) {
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
        <Header title="Post a gig" showBack />
        <RestrictionBanner />
        <GigForm submitLabel="Post Gig" onSubmit={handleSubmit} isLoading={isLoading} />
      </ScreenContainer>
      <ModerationBlockedDialog
        visible={blockedMessage !== null}
        message={blockedMessage ?? ''}
        onEdit={() => setBlockedMessage(null)}
      />
    </>
  )
}
