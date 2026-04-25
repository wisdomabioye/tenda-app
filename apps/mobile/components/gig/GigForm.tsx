import { useState, useEffect } from 'react'
import { View, StyleSheet, ScrollView, KeyboardAvoidingView, Platform } from 'react-native'
import { useUnistyles } from 'react-native-unistyles'
import { typography } from '@/theme/tokens'
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
import {
  isValidPaymentLamports,
  MIN_COMPLETION_DURATION_SECONDS,
  isCrossBorder,
  computePlatformFee,
} from '@tenda/shared'
import { getDeviceCountry } from '@/lib/device'
import { useAuthStore } from '@/stores/auth.store'
import { api } from '@/api/client'
import { LOCATIONS } from '@tenda/shared'
import { formatSolDisplay } from '@/lib/currency'
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
  const homeCountry = useAuthStore((s) => s.user?.country ?? null)
  const isSeeker = useAuthStore((s) => s.user?.is_seeker ?? false)
  const [feeBps, setFeeBps] = useState<number | null>(null)

  useEffect(() => {
    let cancelled = false
    api.platform.config()
      .then((cfg) => {
        if (cancelled) return
        setFeeBps(isSeeker ? cfg.seeker_fee_bps : cfg.fee_bps)
      })
      .catch(() => { /* fall back to null — Summary shows placeholder */ })
    return () => { cancelled = true }
  }, [isSeeker])

  const [title, setTitle]                         = useState(initialValues?.title ?? '')
  const [description, setDescription]             = useState(initialValues?.description ?? '')
  const [paymentLamports, setPaymentLamports]     = useState(initialValues?.paymentLamports ?? 0)
  const [completionDuration, setCompletionDuration] = useState(initialValues?.completionDuration ?? 86_400)
  const [address, setAddress]                     = useState(initialValues?.address ?? '')
  const [selectedCategory, setSelectedCategory]   = useState<GigCategory | null>(initialValues?.category ?? null)
  const [selectedCountry, setSelectedCountry]     = useState<string | null>(initialValues?.country ?? getDeviceCountry())
  const [isRemote, setIsRemote]                   = useState(initialValues?.remote ?? false)
  const [selectedCity, setSelectedCity]           = useState<string | null>(initialValues?.city ?? null)
  const [acceptDeadlineHours, setAcceptDeadlineHours] = useState<number | null>(initialValues?.acceptDeadlineHours ?? null)

  const isValid =
    title.trim().length > 0 &&
    description.trim().length > 0 &&
    isValidPaymentLamports(paymentLamports) &&
    selectedCategory !== null &&
    (isRemote || (selectedCountry !== null && selectedCity !== null)) &&
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

        {!isRemote && (
          <View style={[s.fieldWrap, { marginTop: 10 }]}>
            <Input
              label="Address (optional)"
              placeholder="e.g. 12 Broad Street, Lagos Island"
              helper="Physical location if the gig requires in-person work."
              value={address}
              onChangeText={setAddress}
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
            <FeeSummary paymentLamports={paymentLamports} feeBps={feeBps} />
          </>
        )}

        <View style={s.spacer} />
      </ScrollView>

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
    </KeyboardAvoidingView>
  )
}

const LAMPORTS_PER_SOL = 1_000_000_000

function FeeSummary({ paymentLamports, feeBps }: { paymentLamports: number; feeBps: number | null }) {
  const { theme } = useUnistyles()

  const paymentSol = paymentLamports / LAMPORTS_PER_SOL
  const feeLamports = feeBps != null
    ? Number(computePlatformFee(BigInt(paymentLamports), feeBps))
    : null
  const feeSol = feeLamports != null ? feeLamports / LAMPORTS_PER_SOL : null
  const totalSol = feeSol != null ? paymentSol + feeSol : null
  const feePct = feeBps != null ? (feeBps / 100).toFixed(2) : '—'

  return (
    <View
      style={[
        fs.card,
        {
          backgroundColor: theme.colors.surface.card,
          borderColor: theme.colors.border.default,
        },
      ]}
    >
      <Text style={[fs.eyebrow, { color: theme.colors.content.tertiary }]}>
        YOU WILL ESCROW
      </Text>
      <View style={fs.row}>
        <Text size={13.5} color={theme.colors.content.secondary}>Budget</Text>
        <Text style={[fs.v, { color: theme.colors.content.primary }]}>
          {formatSolDisplay(paymentSol)}
        </Text>
      </View>
      <View style={fs.row}>
        <Text size={13.5} color={theme.colors.content.secondary}>
          {`Platform fee (${feePct}%)`}
        </Text>
        <Text style={[fs.v, { color: theme.colors.content.primary }]}>
          {feeSol != null ? formatSolDisplay(feeSol) : '—'}
        </Text>
      </View>
      <View
        style={[
          fs.row,
          fs.totalRow,
          { borderTopColor: theme.colors.border.subtle },
        ]}
      >
        <Text size={13.5} weight="semibold" color={theme.colors.content.primary}>
          Total to escrow
        </Text>
        <Text style={[fs.vTotal, { color: theme.colors.content.primary }]}>
          {totalSol != null ? formatSolDisplay(totalSol) : '—'}
        </Text>
      </View>
    </View>
  )
}

const fs = StyleSheet.create({
  card: {
    marginHorizontal: 20,
    marginTop: 12,
    borderRadius: 16,
    borderWidth: 1,
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  eyebrow: {
    fontFamily: typography.fonts.mono,
    fontSize: 9.5,
    lineHeight: 12,
    fontWeight: '600',
    letterSpacing: 0.95,
    marginBottom: 10,
    includeFontPadding: false,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    paddingVertical: 6,
  },
  v: {
    fontFamily: typography.fonts.mono,
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: -0.065,
  },
  totalRow: {
    marginTop: 6,
    paddingTop: 10,
    borderTopWidth: 1,
  },
  vTotal: {
    fontFamily: typography.fonts.mono,
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: -0.075,
  },
})

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
