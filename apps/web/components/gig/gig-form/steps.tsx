'use client'

/**
 * The composer's three steps — web twins of mobile's gig-form/steps/*. Each
 * renders one slice of the shared step contract; all state lives in
 * useGigForm.
 */
import { DESC_MAX, TITLE_MAX, formatAssetAmount, formatDuration } from '@tenda/shared'
import { controlClassName } from '@/components/ui/TextField'
import { CategoryGrid } from '../CategoryGrid'
import { CountryCityPicker } from '@/components/form/CountryCityPicker'
import { RemoteToggle } from '@/components/form/RemoteToggle'
import { PaymentInput } from '@/components/form/PaymentInput'
import { DurationPicker } from '@/components/form/DurationPicker'
import { FeeSummary } from '@/components/shared/FeeSummary'
import { AddFundsNudge } from './AddFundsNudge'
import { CrossBorderBanner } from './CrossBorderBanner'
import { AcceptDeadlinePicker } from './AcceptDeadlinePicker'
import { AcceptanceModePicker } from './AcceptanceModePicker'
import { NetworkPicker } from './NetworkPicker'
import { ProofRequirementPicker } from './ProofRequirementPicker'
import type { GigFormController } from '@/hooks/gig/useGigForm'

function SectionLabel({ children }: { children: string }) {
  return <p className="mt-2 text-sm font-semibold text-content-primary">{children}</p>
}

function CharCounter({ value, max }: { value: string; max: number }) {
  return (
    <span className="self-end text-xs text-content-tertiary">
      {value.length}/{max}
    </span>
  )
}

export function GigDetailsStep({ form }: { form: GigFormController }) {
  return (
    <div className="flex flex-col gap-4">
      <SectionLabel>Category</SectionLabel>
      <CategoryGrid selected={form.selectedCategory} onChange={form.setSelectedCategory} />

      <SectionLabel>Gig details</SectionLabel>
      <label className="flex flex-col gap-1 text-sm font-semibold text-control-input-label">
        Title
        <input
          className={controlClassName}
          placeholder="e.g. Deliver a package to Victoria Island"
          value={form.title}
          maxLength={TITLE_MAX}
          onChange={(e) => form.setTitle(e.target.value)}
        />
        <span className="flex justify-between font-normal">
          <span className="text-xs text-content-tertiary">Make it specific and easy to scan.</span>
          <CharCounter value={form.title} max={TITLE_MAX} />
        </span>
      </label>
      <label className="flex flex-col gap-1 text-sm font-semibold text-control-input-label">
        Description
        <textarea
          className={`${controlClassName} min-h-32 resize-y`}
          placeholder="Describe the task, expectations, and deliverables…"
          value={form.description}
          maxLength={DESC_MAX}
          onChange={(e) => form.setDescription(e.target.value)}
        />
        <span className="flex justify-between gap-4 font-normal">
          <span className="text-xs text-content-tertiary">{form.descriptionHint}</span>
          <CharCounter value={form.description} max={DESC_MAX} />
        </span>
      </label>

      <SectionLabel>Where it happens</SectionLabel>
      <RemoteToggle value={form.isRemote} onChange={form.setIsRemote} />
      {!form.isRemote && (
        <CountryCityPicker
          country={form.selectedCountry}
          city={form.selectedCity}
          onChange={(country, city) => {
            form.setSelectedCountry(country)
            form.setSelectedCity(city)
          }}
        />
      )}
      <CrossBorderBanner
        remote={form.isRemote}
        country={form.selectedCountry}
        homeCountry={form.homeCountry}
        assetSymbol={form.assetSymbol}
      />
    </div>
  )
}

export function GigPaymentStep({ form }: { form: GigFormController }) {
  return (
    <div className="flex flex-col gap-4">
      <NetworkPicker
        options={form.chainOptions}
        selected={form.chainId}
        onSelect={form.setChainId}
        assetSymbol={form.assetSymbol}
      />

      <SectionLabel>Budget</SectionLabel>
      <PaymentInput asset={form.asset} value={form.paymentRaw} onChange={form.setPaymentRaw} />
      <AddFundsNudge chainId={form.chainId} asset={form.asset} paymentRaw={form.paymentRaw} />

      <SectionLabel>Delivery time</SectionLabel>
      <DurationPicker value={form.completionDuration} onChange={form.setCompletionDuration} />
      <AcceptDeadlinePicker value={form.acceptDeadlineHours} onChange={form.setAcceptDeadlineHours} />

      {form.paymentRaw > 0 && (
        <>
          <SectionLabel>Cost breakdown</SectionLabel>
          <FeeSummary asset={form.asset} principalRaw={String(form.paymentRaw)} />
        </>
      )}
    </div>
  )
}

export function GigDeliveryStep({ form }: { form: GigFormController }) {
  const location = form.isRemote
    ? 'Remote'
    : [form.selectedCity, form.selectedCountry].filter(Boolean).join(', ')

  return (
    <div className="flex flex-col gap-4">
      <SectionLabel>Who can take it</SectionLabel>
      <AcceptanceModePicker requiresApproval={form.requiresApproval} onChange={form.setRequiresApproval} />

      <SectionLabel>Proof of completion</SectionLabel>
      <ProofRequirementPicker value={form.proofRequirements} onChange={form.setProofRequirements} />

      <SectionLabel>Review</SectionLabel>
      <div className="flex flex-col gap-2 rounded-card border border-border-default bg-surface-card p-4">
        <p className="text-sm font-bold text-content-primary">{form.title}</p>
        <hr className="border-border-subtle" />
        <ReviewRow label="Location" value={location} />
        <ReviewRow label="Budget" value={formatAssetAmount(String(form.paymentRaw), form.asset)} emphasized />
        <ReviewRow label="Timing" value={`${formatDuration(form.completionDuration)} to complete`} />
        <ReviewRow
          label="Acceptance"
          value={form.requiresApproval ? 'You approve an applicant' : 'First qualified worker'}
        />
      </div>
      <p className="text-center text-xs text-content-tertiary">
        You can review the escrow terms once more before your wallet opens.
      </p>
    </div>
  )
}

function ReviewRow({ label, value, emphasized = false }: { label: string; value: string; emphasized?: boolean }) {
  return (
    <p className="flex items-baseline justify-between text-sm">
      <span className="text-content-secondary">{label}</span>
      <span className={emphasized ? 'font-mono font-bold text-content-primary' : 'text-content-primary'}>
        {value}
      </span>
    </p>
  )
}
