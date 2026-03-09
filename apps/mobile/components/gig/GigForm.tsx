import { useState } from 'react'
import { View, StyleSheet, ScrollView, KeyboardAvoidingView, Platform } from 'react-native'
import { useUnistyles } from 'react-native-unistyles'
import { spacing } from '@/theme/tokens'
import { Text } from '@/components/ui/Text'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { Chip } from '@/components/ui/Chip'
import { Spacer } from '@/components/ui/Spacer'
import { Card } from '@/components/ui/Card'
import { PaymentInput } from '@/components/form/PaymentInput'
import { DurationPicker } from '@/components/form/DurationPicker'
import { LocationPicker } from '@/components/form/LocationPicker'
import { RemoteToggle } from '@/components/form/RemoteToggle'
import { CATEGORY_META } from '@/data/mock'
import { isValidPaymentLamports, MIN_COMPLETION_DURATION_SECONDS } from '@tenda/shared'
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

export const ACCEPT_DEADLINE_OPTIONS: Array<{ label: string; hours: number | null }> = [
  { label: 'No limit', hours: null },
  { label: '12h',      hours: 12 },
  { label: '24h',      hours: 24 },
  { label: '48h',      hours: 48 },
  { label: '3d',       hours: 72 },
  { label: '7d',       hours: 168 },
]

export interface GigFormValues {
  title: string
  description: string
  paymentLamports: number
  completionDuration: number
  category: GigCategory | null
  country: string | null
  remote: boolean
  city: string | null
  address: string
  acceptDeadlineHours: number | null
}

interface GigFormProps {
  initialValues?: Partial<GigFormValues>
  onSubmit: (values: GigFormValues) => Promise<void>
  submitLabel: string
  isLoading: boolean
}

export function GigForm({ initialValues, onSubmit, submitLabel, isLoading }: GigFormProps) {
  const { theme } = useUnistyles()

  const [title, setTitle]                         = useState(initialValues?.title ?? '')
  const [description, setDescription]             = useState(initialValues?.description ?? '')
  const [paymentLamports, setPaymentLamports]     = useState(initialValues?.paymentLamports ?? 0)
  const [completionDuration, setCompletionDuration] = useState(initialValues?.completionDuration ?? 86_400)
  const [address, setAddress]                     = useState(initialValues?.address ?? '')
  const [selectedCategory, setSelectedCategory]   = useState<GigCategory | null>(initialValues?.category ?? null)
  const [selectedCountry, setSelectedCountry]     = useState<string | null>(initialValues?.country ?? null)
  const [isRemote, setIsRemote]                   = useState(initialValues?.remote ?? false)
  const [selectedCity, setSelectedCity]           = useState<string | null>(initialValues?.city ?? null)
  const [acceptDeadlineHours, setAcceptDeadlineHours] = useState<number | null>(initialValues?.acceptDeadlineHours ?? null)
  const [showAdvanced, setShowAdvanced]           = useState(initialValues?.acceptDeadlineHours != null)

  const isValid =
    title.trim().length > 0 &&
    description.trim().length > 0 &&
    isValidPaymentLamports(paymentLamports) &&
    selectedCategory !== null &&
    selectedCountry !== null &&
    (isRemote || selectedCity !== null) &&
    completionDuration >= MIN_COMPLETION_DURATION_SECONDS

  async function handleSubmit() {
    if (!isValid) return
    await onSubmit({
      title,
      description,
      paymentLamports,
      completionDuration,
      category: selectedCategory,
      country: selectedCountry,
      remote: isRemote,
      city: isRemote ? null : selectedCity,
      address: isRemote ? '' : address,
      acceptDeadlineHours,
    })
  }

  const descriptionHint = selectedCategory
    ? CATEGORY_HINTS[selectedCategory]
    : 'Include scope, requirements, and expectations'

  return (
    <KeyboardAvoidingView style={s.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView
        style={s.flex}
        contentContainerStyle={s.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Category */}
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

          <RemoteToggle value={isRemote} onChange={setIsRemote} />

          <Spacer size={spacing.md} />

          <LocationPicker
            country={selectedCountry}
            city={isRemote ? null : selectedCity}
            onChange={(c, ci) => {
              setSelectedCountry(c)
              if (!isRemote) setSelectedCity(ci)
            }}
            label={isRemote ? 'Country' : 'Location'}
          />

          {!isRemote && (
            <>
              <Spacer size={spacing.md} />
              <Input
                label="Address (optional)"
                placeholder="e.g. 12 Broad Street, Lagos Island"
                helper="Physical location if the gig requires in-person work"
                value={address}
                onChangeText={setAddress}
              />
            </>
          )}
        </Card>

        <Spacer size={spacing.md} />

        {/* Advanced */}
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
          onPress={handleSubmit}
        >
          {submitLabel}
        </Button>

        <Spacer size={spacing.md} />
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

const s = StyleSheet.create({
  flex:      { flex: 1 },
  content:   { paddingHorizontal: spacing.md, paddingTop: spacing.sm },
  multiline: { minHeight: 100, textAlignVertical: 'top' },
  chipGroup: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
})
