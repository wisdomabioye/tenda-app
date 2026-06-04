import { useState } from 'react'
import { useRouter } from 'expo-router'
import { View, StyleSheet, ScrollView, KeyboardAvoidingView, Platform, Pressable } from 'react-native'
import { useUnistyles } from 'react-native-unistyles'
import { Text } from '@/components/ui/Text'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { Chip } from '@/components/ui/Chip'
import { SectionLabel } from '@/components/ui/SectionLabel'
import { CategoryGrid } from '@/components/gig/CategoryGrid'
import { PaymentInput } from '@/components/form/PaymentInput'
import { DurationPicker } from '@/components/form/DurationPicker'
import { LocationPicker } from '@/components/form/LocationPicker'
import { RemoteToggle } from '@/components/form/RemoteToggle'
import { FeeSummary } from '@/components/shared/FeeSummary'
import {
  isValidPaymentLamports,
  MIN_COMPLETION_DURATION_SECONDS,
  isCrossBorder,
} from '@tenda/shared'
import { getDeviceCountry } from '@/lib/device'
import { useAuthStore } from '@/stores/auth.store'
import { useModerationPreview } from '@/hooks/useModerationPreview'
import { useWalletBalance } from '@/hooks/useWalletBalance'
import { PriceWarningSheet } from '@/components/moderation/PriceWarningSheet'
import { LOCATIONS } from '@tenda/shared'
import type { GigCategory, CountryCode } from '@tenda/shared'

const TITLE_MAX = 80
const DESC_MAX = 1500

const CATEGORY_HINTS: Record<GigCategory, string> = {
  delivery: 'Pickup address, drop-off, package size, fragility notes.',
  photo:    'Type of shoot (product/event/portrait), duration, edits expected.',
  errand:   'What needs doing, where, and any items + budget to purchase.',
  service:  'Type of service, tools/materials, accessibility requirements.',
  digital:  'Scope, deliverable format, revision rounds, tools/accounts.',
}

// v2 escrows REQUIRE an accept deadline (the on-chain refund window keys
// off it) — '30d' is the long-tail option that replaced 'No limit'.
export const ACCEPT_DEADLINE_OPTIONS: Array<{ label: string; hours: number }> = [
  { label: '12h', hours: 12 },
  { label: '24h', hours: 24 },
  { label: '48h', hours: 48 },
  { label: '3d',  hours: 72 },
  { label: '7d',  hours: 168 },
  { label: '30d', hours: 720 },
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
  acceptDeadlineHours: number
}

interface GigFormProps {
  initialValues?: Partial<GigFormValues>
  onSubmit: (values: GigFormValues) => Promise<void>
  submitLabel: string
  isLoading: boolean
}

export function GigForm({ initialValues, onSubmit, submitLabel, isLoading }: GigFormProps) {
  const { theme } = useUnistyles()
  const router = useRouter()
  const { balanceLamports } = useWalletBalance()
  const homeCountry = useAuthStore((s) => s.user?.country ?? null)

  const [title, setTitle]                         = useState(initialValues?.title ?? '')
  const [description, setDescription]             = useState(initialValues?.description ?? '')
  const [paymentLamports, setPaymentLamports]     = useState(initialValues?.paymentLamports ?? 0)
  const [completionDuration, setCompletionDuration] = useState(initialValues?.completionDuration ?? 86_400)
  const [selectedCategory, setSelectedCategory]   = useState<GigCategory | null>(initialValues?.category ?? null)
  const [selectedCountry, setSelectedCountry]     = useState<string | null>(initialValues?.country ?? getDeviceCountry())
  const [isRemote, setIsRemote]                   = useState(initialValues?.remote ?? false)
  const [selectedCity, setSelectedCity]           = useState<string | null>(initialValues?.city ?? null)
  const [acceptDeadlineHours, setAcceptDeadlineHours] = useState<number>(initialValues?.acceptDeadlineHours ?? 168)

  const [warnSheetOpen, setWarnSheetOpen] = useState(false)

  // Stage-6 live moderation hints — debounced, advisory only; the server
  // re-runs the same pipeline on create and stays authoritative.
  const moderation = useModerationPreview({
    title,
    description,
    category: selectedCategory,
    country: selectedCountry,
    paymentLamports,
  })

  const isValid =
    title.trim().length > 0 &&
    description.trim().length > 0 &&
    isValidPaymentLamports(paymentLamports) &&
    selectedCategory !== null &&
    (isRemote || (selectedCountry !== null && selectedCity !== null)) &&
    completionDuration >= MIN_COMPLETION_DURATION_SECONDS

  async function handleSubmit() {
    if (!isValid) return
    // Warn verdicts get one explicit confirmation before publishing.
    if (moderation?.decision === 'warn' && !warnSheetOpen) {
      setWarnSheetOpen(true)
      return
    }
    setWarnSheetOpen(false)
    await submitValues()
  }

  async function submitValues() {
    await onSubmit({
      title,
      description,
      paymentLamports,
      completionDuration,
      category: selectedCategory,
      country: selectedCountry,
      remote: isRemote,
      city: isRemote ? null : selectedCity,
      acceptDeadlineHours,
    })
  }

  const descriptionHint = selectedCategory
    ? CATEGORY_HINTS[selectedCategory]
    : 'Include scope, requirements, and expectations.'

  return (
    <KeyboardAvoidingView style={s.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        style={s.flex}
        contentContainerStyle={s.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Details */}
        <SectionLabel>Details</SectionLabel>
        <View style={s.fieldWrap}>
          <Input
            label="Title"
            placeholder="e.g. Deliver package to Victoria Island"
            helper="Make it short and clear."
            value={title}
            onChangeText={setTitle}
            maxLength={TITLE_MAX}
            showCounter
          />
        </View>
        <View style={[s.fieldWrap, { marginTop: 10 }]}>
          <Input
            label="Description"
            placeholder="Describe the gig in detail…"
            helper={descriptionHint}
            value={description}
            onChangeText={setDescription}
            multiline
            maxLength={DESC_MAX}
            showCounter
          />
        </View>

        {/* Category */}
        <SectionLabel>Category</SectionLabel>
        <CategoryGrid selected={selectedCategory} onChange={setSelectedCategory} />

        {/* Location */}
        <SectionLabel>Location</SectionLabel>
        <View style={s.toggleWrap}>
          <RemoteToggle value={isRemote} onChange={setIsRemote} />
        </View>
        {!isRemote && (
          <View style={[s.locationWrap, { marginTop: 10 }]}>
            <LocationPicker
              country={selectedCountry}
              city={selectedCity}
              onChange={(c, ci) => { setSelectedCountry(c); setSelectedCity(ci) }}
            />
          </View>
        )}

        {isCrossBorder(isRemote, selectedCountry, homeCountry) && (
          <View
            style={[
              s.crossBorderBanner,
              {
                backgroundColor: theme.colors.brand.primarySurface,
                borderColor: theme.colors.brand.primaryBorder,
              },
            ]}
          >
            <Text size={13} weight="semibold" color={theme.colors.brand.primary}>
              ↔ Cross-border posting
            </Text>
            <Text size={12} color={theme.colors.brand.primary} style={s.bannerSub}>
              Workers in {LOCATIONS[selectedCountry as CountryCode]?.name ?? selectedCountry} receive SOL and can off-ramp via Tenda P2P.
            </Text>
          </View>
        )}

        {/* Budget */}
        <SectionLabel>Budget</SectionLabel>
        <PaymentInput value={paymentLamports} onChange={setPaymentLamports} />

        {/* Stage 8: chained buy-then-post — advisory only; funding happens at publish */}
        {balanceLamports !== null && paymentLamports > balanceLamports && (
          <Pressable
            onPress={() => router.push('/wallet/buy-sell?tab=buy' as Parameters<typeof router.push>[0])}
            style={({ pressed }) => [
              s.addFunds,
              { backgroundColor: theme.colors.brand.primarySurface, borderColor: theme.colors.brand.primaryBorder },
              pressed && { opacity: 0.8 },
            ]}
            accessibilityRole="button"
            accessibilityLabel="Add funds"
          >
            <Text style={[s.addFundsText, { color: theme.colors.brand.primary }]}>
              Your balance won&apos;t cover this amount — add funds. Your draft stays right here.
            </Text>
          </Pressable>
        )}

        {/* Timing */}
        <SectionLabel>Timing</SectionLabel>
        <View style={s.durationWrap}>
          <DurationPicker value={completionDuration} onChange={setCompletionDuration} />
        </View>

        {/* Accept deadline */}
        <SectionLabel>Accept deadline</SectionLabel>
        <Text style={[s.sectionHint, { color: theme.colors.content.tertiary }]}>
          How long the gig stays open for workers to accept.
        </Text>
        <View style={s.chipRow}>
          {ACCEPT_DEADLINE_OPTIONS.map((opt) => (
            <Chip
              key={String(opt.hours)}
              label={opt.label}
              variant="form"
              selected={acceptDeadlineHours === opt.hours}
              onPress={() => setAcceptDeadlineHours(opt.hours)}
            />
          ))}
        </View>

        {/* Summary — fee breakdown */}
        {paymentLamports > 0 && (
          <>
            <SectionLabel>Summary</SectionLabel>
            <FeeSummary
              principalLamports={paymentLamports}
              eyebrow="YOU WILL ESCROW"
              totalLabel="Total to escrow"
            />
          </>
        )}

        <View style={s.spacer} />
      </ScrollView>

      {/* Stage-6 live moderation hint — advisory, never blocking */}
      {moderation !== null && moderation.decision !== 'approve' && moderation.reasons.length > 0 && (
        <View
          style={[
            s.moderationHint,
            {
              backgroundColor:
                moderation.decision === 'block'
                  ? theme.colors.feedback.danger.surface
                  : theme.colors.feedback.warning.surface,
            },
          ]}
        >
          <Text
            style={[
              s.moderationHintText,
              {
                color:
                  moderation.decision === 'block'
                    ? theme.colors.feedback.danger.base
                    : theme.colors.feedback.warning.base,
              },
            ]}
          >
            {moderation.reasons[0].message}
          </Text>
        </View>
      )}

      {/* Sticky submit bar */}
      <View
        style={[
          s.submitBar,
          {
            backgroundColor: theme.colors.surface.background,
            borderTopColor: theme.colors.border.subtle,
          },
        ]}
      >
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
      </View>

      <PriceWarningSheet
        visible={warnSheetOpen}
        reasons={moderation?.reasons ?? []}
        onPublishAnyway={() => {
          setWarnSheetOpen(false)
          void submitValues()
        }}
        onEdit={() => setWarnSheetOpen(false)}
      />
    </KeyboardAvoidingView>
  )
}

const s = StyleSheet.create({
  flex: { flex: 1 },
  content: {
    paddingBottom: 20,
  },
  fieldWrap: {
    marginHorizontal: 20,
  },
  locationWrap: {
    // LocationPicker has its own marginHorizontal: 20 baked in
  },
  toggleWrap: {
    marginTop: 10,
  },
  crossBorderBanner: {
    marginHorizontal: 20,
    marginTop: 10,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderRadius: 12,
    gap: 2,
  },
  bannerSub: {
    lineHeight: 17,
  },
  durationWrap: {
    paddingHorizontal: 20,
  },
  sectionHint: {
    fontSize: 12.5,
    lineHeight: 17,
    paddingHorizontal: 20,
    paddingBottom: 8,
    marginTop: -4,
  },
  chipRow: {
    paddingHorizontal: 20,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  spacer: {
    height: 24,
  },
  addFunds: {
    marginHorizontal: 20,
    marginTop: 10,
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  addFundsText: {
    fontSize: 12.5,
    lineHeight: 17,
  },
  moderationHint: {
    marginHorizontal: 20,
    marginBottom: 8,
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  moderationHintText: {
    fontSize: 12.5,
    lineHeight: 17,
  },
  submitBar: {
    flexShrink: 0,
    paddingTop: 12,
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderTopWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -6 },
    shadowOpacity: 0.05,
    shadowRadius: 18,
    elevation: 6,
  },
})
