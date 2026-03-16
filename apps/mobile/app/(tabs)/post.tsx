import { useState, useEffect } from 'react'
import { useRouter } from 'expo-router'
import { ScreenContainer } from '@/components/ui/ScreenContainer'
import { Header } from '@/components/ui'
import { showToast } from '@/components/ui/Toast'
import { GigForm } from '@/components/gig/GigForm'
import { NudgeSheet } from '@/components/onboarding/NudgeSheet'
import { useOnboardingStore } from '@/stores/onboarding.store'
import { api } from '@/api/client'
import type { GigFormValues } from '@/components/gig/GigForm'

export default function PostGigScreen() {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)
  const [showNudge, setShowNudge] = useState(false)
  const { dismissedNudges } = useOnboardingStore()

  useEffect(() => {
    if (!dismissedNudges.post) setShowNudge(true)
  }, [])

  async function handleSubmit(values: GigFormValues) {
    if (!values.category) return
    if (!values.remote && (!values.country || !values.city)) return

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
        city: values.city || undefined,
        address: values.address.trim() || undefined,
        completion_duration_seconds: values.completionDuration,
        accept_deadline,
      })
      showToast('success', 'Draft saved! Publish it from the gig page.')
      router.navigate('/(tabs)/home' as any)
      router.push(`/gig/${gig.id}` as any)
    } catch (e) {
      showToast('error', (e as Error).message || 'Failed to create gig')
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
      <ScreenContainer scroll={false} padding={false} edges={['left', 'right', 'bottom']}>
        <Header title="Post a gig" showBack />
        <GigForm submitLabel="Save Draft" onSubmit={handleSubmit} isLoading={isLoading} />
      </ScreenContainer>
    </>
  )
}
