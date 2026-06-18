import { View, StyleSheet, ScrollView, KeyboardAvoidingView, Platform } from 'react-native'
import { useUnistyles } from 'react-native-unistyles'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { SectionLabel } from '@/components/ui/SectionLabel'
import { CategoryGrid } from '@/components/gig/CategoryGrid'
import { PaymentInput } from '@/components/form/PaymentInput'
import { DurationPicker } from '@/components/form/DurationPicker'
import { LocationPicker } from '@/components/form/LocationPicker'
import { RemoteToggle } from '@/components/form/RemoteToggle'
import { FeeSummary } from '@/components/shared/FeeSummary'
import { PriceWarningSheet } from '@/components/moderation/PriceWarningSheet'
import { useGigForm } from './gig-form/useGigForm'
import { TITLE_MAX, DESC_MAX } from './gig-form/constants'
import { CrossBorderBanner } from './gig-form/CrossBorderBanner'
import { NetworkPicker } from './gig-form/NetworkPicker'
import { AddFundsNudge } from './gig-form/AddFundsNudge'
import { AcceptDeadlinePicker } from './gig-form/AcceptDeadlinePicker'
import { ModerationHint } from './gig-form/ModerationHint'
import type { GigFormValues } from './gig-form/constants'

export type { GigFormValues } from './gig-form/constants'
export { ACCEPT_DEADLINE_OPTIONS } from './gig-form/constants'

interface GigFormProps {
  initialValues?: Partial<GigFormValues>
  onSubmit: (values: GigFormValues) => Promise<void>
  submitLabel: string
  isLoading: boolean
}

export function GigForm({ initialValues, onSubmit, submitLabel, isLoading }: GigFormProps) {
  const { theme } = useUnistyles()
  const f = useGigForm(initialValues, onSubmit)

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
            value={f.title}
            onChangeText={f.setTitle}
            maxLength={TITLE_MAX}
            showCounter
          />
        </View>
        <View style={[s.fieldWrap, { marginTop: 10 }]}>
          <Input
            label="Description"
            placeholder="Describe the gig in detail…"
            helper={f.descriptionHint}
            value={f.description}
            onChangeText={f.setDescription}
            multiline
            maxLength={DESC_MAX}
            showCounter
          />
        </View>

        {/* Category */}
        <SectionLabel>Category</SectionLabel>
        <CategoryGrid selected={f.selectedCategory} onChange={f.setSelectedCategory} />

        {/* Location */}
        <SectionLabel>Location</SectionLabel>
        <View style={s.toggleWrap}>
          <RemoteToggle value={f.isRemote} onChange={f.setIsRemote} />
        </View>
        {!f.isRemote && (
          <View style={s.locationWrap}>
            <LocationPicker
              country={f.selectedCountry}
              city={f.selectedCity}
              onChange={(c, ci) => { f.setSelectedCountry(c); f.setSelectedCity(ci) }}
            />
          </View>
        )}

        <CrossBorderBanner
          remote={f.isRemote}
          country={f.selectedCountry}
          homeCountry={f.homeCountry}
          assetSymbol={f.assetSymbol}
        />

        {/* Network (CO5) — gigs are USDC-denominated on every chain */}
        <NetworkPicker
          options={f.chainOptions}
          selected={f.chainId}
          onSelect={f.setChainId}
          assetSymbol={f.assetSymbol}
        />

        {/* Budget */}
        <SectionLabel>Budget</SectionLabel>
        <PaymentInput asset={f.asset} value={f.paymentRaw} onChange={f.setPaymentRaw} />
        <AddFundsNudge asset={f.asset} paymentRaw={f.paymentRaw} />

        {/* Timing */}
        <SectionLabel>Timing</SectionLabel>
        <View style={s.durationWrap}>
          <DurationPicker value={f.completionDuration} onChange={f.setCompletionDuration} />
        </View>

        {/* Accept deadline */}
        <AcceptDeadlinePicker value={f.acceptDeadlineHours} onChange={f.setAcceptDeadlineHours} />

        {/* Summary — fee breakdown */}
        {f.paymentRaw > 0 && (
          <>
            <SectionLabel>Summary</SectionLabel>
            <FeeSummary
              asset={f.asset}
              principalRaw={f.paymentRaw}
              eyebrow="YOU WILL ESCROW"
              totalLabel="Total to escrow"
            />
          </>
        )}

        <View style={s.spacer} />
      </ScrollView>

      <ModerationHint moderation={f.moderation} />

      {/* Sticky submit bar */}
      <View
        style={[
          s.submitBar,
          { backgroundColor: theme.colors.surface.background, borderTopColor: theme.colors.border.subtle },
        ]}
      >
        <Button
          variant="primary"
          size="lg"
          fullWidth
          disabled={!f.isValid}
          loading={isLoading}
          onPress={f.handleSubmit}
        >
          {submitLabel}
        </Button>
      </View>

      <PriceWarningSheet
        visible={f.warnSheetOpen}
        reasons={f.moderation?.reasons ?? []}
        onPublishAnyway={() => {
          f.setWarnSheetOpen(false)
          void f.submitValues()
        }}
        onEdit={() => f.setWarnSheetOpen(false)}
      />
    </KeyboardAvoidingView>
  )
}

const s = StyleSheet.create({
  flex: { flex: 1 },
  content: { paddingBottom: 20 },
  fieldWrap: { marginHorizontal: 20 },
  // LocationPicker has its own marginHorizontal: 20 baked in
  locationWrap: { marginTop: 10 },
  toggleWrap: { marginTop: 10 },
  durationWrap: { paddingHorizontal: 20 },
  spacer: { height: 24 },
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
