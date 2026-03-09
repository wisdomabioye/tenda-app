import { useState } from 'react'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { ScreenContainer } from '@/components/ui/ScreenContainer'
import { Header } from '@/components/ui/Header'
import { LoadingScreen } from '@/components/feedback/LoadingScreen'
import { showToast } from '@/components/ui/Toast'
import { GigForm, ACCEPT_DEADLINE_OPTIONS } from '@/components/gig/GigForm'
import { useGigsStore } from '@/stores/gigs.store'
import { api } from '@/api/client'
import type { GigFormValues } from '@/components/gig/GigForm'
import type { GigDetail } from '@tenda/shared'

function closestDeadlineOption(remainingHours: number): number | null {
  const options = ACCEPT_DEADLINE_OPTIONS.filter((o) => o.hours !== null) as Array<{ label: string; hours: number }>
  if (options.length === 0) return null
  return options.reduce((best, opt) =>
    Math.abs(opt.hours - remainingHours) < Math.abs(best.hours - remainingHours) ? opt : best
  ).hours
}

function EditGigContent({ gig }: { gig: GigDetail }) {
  const router = useRouter()
  const { fetchGigDetail } = useGigsStore()
  const [isLoading, setIsLoading] = useState(false)

  const acceptDeadlineHours = gig.accept_deadline
    ? closestDeadlineOption(
        Math.round((new Date(gig.accept_deadline).getTime() - Date.now()) / 3_600_000),
      )
    : null

  const initialValues: GigFormValues = {
    title:               gig.title,
    description:         gig.description,
    paymentLamports:     gig.payment_lamports,
    completionDuration:  gig.completion_duration_seconds,
    category:            gig.category,
    country:             gig.country,
    remote:              gig.remote,
    city:                gig.city,
    address:             gig.address ?? '',
    acceptDeadlineHours,
  }

  async function handleSubmit(values: GigFormValues) {
    const accept_deadline = values.acceptDeadlineHours
      ? new Date(Date.now() + values.acceptDeadlineHours * 3_600_000).toISOString()
      : null

    setIsLoading(true)
    try {
      await api.gigs.update({ id: gig.id }, {
        title:                       values.title.trim(),
        description:                 values.description.trim(),
        payment_lamports:            values.paymentLamports,
        category:                    values.category ?? undefined,
        country:                     values.country ?? undefined,
        remote:                      values.remote,
        city:                        values.remote ? null : (values.city ?? undefined),
        address:                     values.address.trim() || null,
        completion_duration_seconds: values.completionDuration,
        accept_deadline,
      })
      showToast('success', 'Draft updated!')
      fetchGigDetail(gig.id)
      router.back()
    } catch (e) {
      showToast('error', (e as Error).message || 'Failed to update gig')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <ScreenContainer scroll={false} padding={false} edges={['left', 'right', 'bottom']}>
      <Header title="Edit gig" showBack />
      <GigForm
        initialValues={initialValues}
        submitLabel="Save Changes"
        onSubmit={handleSubmit}
        isLoading={isLoading}
      />
    </ScreenContainer>
  )
}

export default function EditGigScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const { selectedGig } = useGigsStore()

  const gig = selectedGig?.id === id ? selectedGig : null
  if (!gig) return <LoadingScreen />

  return <EditGigContent gig={gig} />
}
