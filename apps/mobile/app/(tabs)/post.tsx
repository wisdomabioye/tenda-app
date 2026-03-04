import { useState, useEffect } from 'react'
import { View, StyleSheet, ScrollView, KeyboardAvoidingView, Platform } from 'react-native'
import { useRouter } from 'expo-router'
import { useUnistyles } from 'react-native-unistyles'
import { spacing } from '@/theme/tokens'
import { ScreenContainer } from '@/components/ui/ScreenContainer'
import { Text } from '@/components/ui/Text'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { Chip } from '@/components/ui/Chip'
import { Spacer } from '@/components/ui/Spacer'
import { Card } from '@/components/ui/Card'
import { Header } from '@/components/ui'
import { showToast } from '@/components/ui/Toast'
import { PaymentInput } from '@/components/form/PaymentInput'
import { DurationPicker } from '@/components/form/DurationPicker'
import { CityPicker } from '@/components/form/CityPicker'
import { CATEGORY_META } from '@/data/mock'
import { isValidPaymentLamports, MIN_COMPLETION_DURATION_SECONDS } from '@tenda/shared'
import { api } from '@/api/client'
import { NudgeSheet } from '@/components/onboarding/NudgeSheet'
import { useOnboardingStore } from '@/stores/onboarding.store'
import type { ColorScheme } from '@/theme/tokens'
import type { GigCategory } from '@tenda/shared'

const TITLE_MAX = 80
const DESC_MAX = 1500

const CATEGORY_HINTS: Record<GigCategory, string> = {
  delivery: 'Include: pickup address, drop-off address, package size/weight, any fragility notes',
  photo:    'Include: type of shoot (product/event/portrait), duration, number of final edits expected',
  errand:   'Include: what needs to be done, where to go, any items to purchase and budget',
  service:  'Include: type of service, tools/materials provided or needed, accessibility requirements',
  digital:  'Include: task scope, deliverable format, revision rounds, any tools or accounts required',
}

const ACCEPT_DEADLINE_OPTIONS: Array<{ label: string; hours: number | null }> = [
  { label: 'No limit', hours: null },
  { label: '12h',      hours: 12 },
  { label: '24h',      hours: 24 },
  { label: '48h',      hours: 48 },
  { label: '3d',       hours: 72 },
  { label: '7d',       hours: 168 },
]

export default function PostGigScreen() {
  const { theme } = useUnistyles()
  const router = useRouter()

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [paymentLamports, setPaymentLamports] = useState(0)
  const [completionDuration, setCompletionDuration] = useState(86_400)
  const [address, setAddress] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<GigCategory | null>(null)
  const [selectedCity, setSelectedCity] = useState<string | null>(null)
  const [acceptDeadlineHours, setAcceptDeadlineHours] = useState<number | null>(null)
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [showNudge, setShowNudge] = useState(false)
  const { dismissedNudges } = useOnboardingStore()

  useEffect(() => {
    if (!dismissedNudges.post) setShowNudge(true)
  }, [])

  const isValid =
    title.trim().length > 0 &&
    description.trim().length > 0 &&
    isValidPaymentLamports(paymentLamports) &&
    selectedCategory !== null &&
    selectedCity !== null &&
    completionDuration >= MIN_COMPLETION_DURATION_SECONDS

  async function handlePost() {
    if (!isValid || !selectedCategory || !selectedCity) return

    const accept_deadline = acceptDeadlineHours
      ? new Date(Date.now() + acceptDeadlineHours * 3_600_000).toISOString()
      : undefined

    setIsLoading(true)
    try {
      const gig = await api.gigs.create({
        title: title.trim(),
        description: description.trim(),
        payment_lamports: paymentLamports,
        category: selectedCategory,
        city: selectedCity,
        address: address.trim() || undefined,
        completion_duration_seconds: completionDuration,
        accept_deadline,
      })
      showToast('success', 'Draft saved! Publish it from the gig page.')
      router.replace(`/gig/${gig.id}` as any)
    } catch (e) {
      showToast('error', (e as Error).message || 'Failed to create gig')
    } finally {
      setIsLoading(false)
    }
  }

  const descriptionHint = selectedCategory ? CATEGORY_HINTS[selectedCategory] : 'Include scope, requirements, and expectations'

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
    <ScreenContainer scroll={false} padding={false}>
      <KeyboardAvoidingView
        style={s.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          style={s.flex}
          contentContainerStyle={s.content}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <Header title="Post a gig" showBack />
          <Spacer size={spacing.sm} />
          <Text variant="body" color={theme.colors.textSub}>
            Describe the task you need done
          </Text>

          <Spacer size={spacing.md} />

          {/* Category — first so hints update before user types */}
          <Card variant="outlined" padding={spacing.md}>
            <Text variant="label" weight="semibold">Category</Text>
            <Spacer size={spacing.sm} />
            <View style={s.chipGroup}>
              {CATEGORY_META.map((cat) => {
                const colorKey = `category${cat.label}` as keyof ColorScheme
                return (
                  <Chip
                    key={cat.key}
                    label={cat.label}
                    selected={selectedCategory === cat.key}
                    color={theme.colors[colorKey]}
                    onPress={() => setSelectedCategory(cat.key)}
                  />
                )
              })}
            </View>
          </Card>

          <Spacer size={spacing.md} />

          {/* Details */}
          <Card variant="outlined" padding={spacing.md}>
            <Text variant="label" weight="semibold">Gig details</Text>
            <Spacer size={spacing.sm} />

            <Input
              label="Title"
              placeholder="e.g. Deliver package to Victoria Island"
              helper="Make it short and clear"
              value={title}
              onChangeText={setTitle}
              maxLength={TITLE_MAX}
              showCounter
            />

            <Spacer size={spacing.md} />

            <Input
              label="Description"
              placeholder="Describe the gig in detail..."
              helper={descriptionHint}
              value={description}
              onChangeText={setDescription}
              multiline
              numberOfLines={5}
              maxLength={DESC_MAX}
              showCounter
              style={s.multiline}
            />

            <Spacer size={spacing.md} />

            <PaymentInput value={paymentLamports} onChange={setPaymentLamports} />

            <Spacer size={spacing.md} />

            <DurationPicker value={completionDuration} onChange={setCompletionDuration} />

            <Spacer size={spacing.md} />

            <CityPicker value={selectedCity} onChange={setSelectedCity} />

            <Spacer size={spacing.md} />

            <Input
              label="Address (optional)"
              placeholder="e.g. 12 Broad Street, Lagos Island"
              helper="Physical location if the gig requires in-person work"
              value={address}
              onChangeText={setAddress}
            />
          </Card>

          <Spacer size={spacing.md} />

          {/* Advanced options */}
          <Chip
            label={showAdvanced ? 'Hide advanced options' : 'Advanced options'}
            selected={showAdvanced}
            onPress={() => setShowAdvanced((v) => !v)}
          />

          {showAdvanced && (
            <>
              <Spacer size={spacing.md} />
              <Card variant="outlined" padding={spacing.md}>
                <Text variant="label" weight="semibold">Accept deadline</Text>
                <Spacer size={4} />
                <Text variant="caption" color={theme.colors.textFaint}>
                  How long the gig stays open for workers to accept
                </Text>
                <Spacer size={spacing.sm} />
                <View style={s.chipGroup}>
                  {ACCEPT_DEADLINE_OPTIONS.map((opt) => (
                    <Chip
                      key={String(opt.hours)}
                      label={opt.label}
                      selected={acceptDeadlineHours === opt.hours}
                      onPress={() => setAcceptDeadlineHours(opt.hours)}
                    />
                  ))}
                </View>
              </Card>
            </>
          )}

          <Spacer size={spacing.lg} />

          <Button
            variant="primary"
            size="lg"
            fullWidth
            disabled={!isValid}
            loading={isLoading}
            onPress={handlePost}
          >
            Save Draft
          </Button>

          <Spacer size={spacing.md} />
        </ScrollView>
      </KeyboardAvoidingView>
    </ScreenContainer>
    </>
  )
}

const s = StyleSheet.create({
  flex: { flex: 1 },
  content: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
  },
  multiline: {
    minHeight: 100,
    textAlignVertical: 'top',
  },
  chipGroup: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
})
