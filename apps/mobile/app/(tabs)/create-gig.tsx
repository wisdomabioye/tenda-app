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
import { coerceCityForCountry, ErrorCode } from '@tenda/shared'
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

  async function handleSubmit(values: GigFormValues) {
    if (!values.category) return
    const safeCity = coerceCityForCountry(values.country, values.city)
    if (!values.remote && (!values.country || !safeCity)) return

    const accept_deadline = values.acceptDeadlineHours
      ? new Date(Date.now() + values.acceptDeadlineHours * 3_600_000).toISOString()
      : undefined

    setIsLoading(true)
    try {
      const gig = await api.gigs.create({
        title: values.title.trim(),
        description: values.description.trim(),
        payment_lamports: values.paymentLamports,
        category: values.category,
        country: values.country ?? undefined,
        remote: values.remote,
        city: safeCity || undefined,
        address: values.address.trim() || undefined,
        completion_duration_seconds: values.completionDuration,
        accept_deadline,
      })
      showToast('success', 'Draft saved! Publish it from the gig page.')
      router.navigate('/(tabs)/home' as any)
      router.push(`/gig/${gig.id}` as any)
    } catch (e) {
      // Stage-6: block verdicts get the full dialog — no retry path.
      if (e instanceof ApiClientError && e.code === ErrorCode.CONTENT_MODERATED) {
        setBlockedMessage(e.message)
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
        <GigForm submitLabel="Save Draft" onSubmit={handleSubmit} isLoading={isLoading} />
      </ScreenContainer>
      <ModerationBlockedDialog
        visible={blockedMessage !== null}
        message={blockedMessage ?? ''}
        onEdit={() => setBlockedMessage(null)}
      />
    </>
  )
}
