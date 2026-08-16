'use client'

/**
 * The gig composer — web port of mobile's GigForm: three-step wizard over
 * the shared step contract, with the live moderation hint and the
 * warn-verdict confirmation.
 */
import { useState } from 'react'
import { GIG_COMPOSER_STEPS, type GigFormValues } from '@tenda/shared'
import { GigComposerNavigation, GigComposerProgress } from './gig-form/GigComposerChrome'
import { GigDeliveryStep, GigDetailsStep, GigPaymentStep } from './gig-form/steps'
import { ModerationHint } from './gig-form/ModerationHint'
import { PriceWarningDialog } from '@/components/moderation/PriceWarningDialog'
import { useGigForm } from '@/hooks/gig/useGigForm'

interface GigFormProps {
  initialValues?: Partial<GigFormValues>
  onSubmit: (values: GigFormValues) => Promise<void>
  submitLabel: string
  isLoading: boolean
}

export function GigForm({ initialValues, onSubmit, submitLabel, isLoading }: GigFormProps) {
  const form = useGigForm(initialValues, onSubmit)
  const [stepIndex, setStepIndex] = useState(0)
  const step = GIG_COMPOSER_STEPS[stepIndex].key
  const finalStep = stepIndex === GIG_COMPOSER_STEPS.length - 1
  const missingRequirement = finalStep
    ? form.missingRequirement
    : form.getStepMissingRequirement(step)

  function moveToStep(nextIndex: number) {
    setStepIndex(nextIndex)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function handleContinue() {
    if (missingRequirement !== null) return
    if (finalStep) {
      void form.handleSubmit()
      return
    }
    moveToStep(stepIndex + 1)
  }

  return (
    <div className="flex flex-col gap-6">
      <GigComposerProgress
        step={step}
        onStepPress={(index) => {
          if (!isLoading) moveToStep(index)
        }}
      />

      {step === 'details' && <GigDetailsStep form={form} />}
      {step === 'payment' && <GigPaymentStep form={form} />}
      {step === 'delivery' && <GigDeliveryStep form={form} />}

      {/* On every step: the verdict needs a budget, which only exists from
          the payment step onward — gating this to one step would hide it. */}
      <ModerationHint moderation={form.moderation} />
      <GigComposerNavigation
        firstStep={stepIndex === 0}
        finalStep={finalStep}
        missingRequirement={missingRequirement}
        submitLabel={submitLabel}
        loading={isLoading}
        onBack={() => moveToStep(stepIndex - 1)}
        onContinue={handleContinue}
      />

      <PriceWarningDialog
        open={form.warnSheetOpen}
        reasons={form.moderation?.reasons ?? []}
        onPublishAnyway={() => {
          form.setWarnSheetOpen(false)
          void form.submitValues()
        }}
        onEdit={() => form.setWarnSheetOpen(false)}
      />
    </div>
  )
}
