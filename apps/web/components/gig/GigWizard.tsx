'use client'

/**
 * The Post Wizard — five steps down a sticky rail, ending at the signature
 * gate. Replaces the three-step composer this surface used before; the fields
 * and the controller are unchanged, only their grouping and chrome.
 *
 * The gate itself (TxConfirmDialog), the monitor and the blocked dialog live
 * on the route, because they belong to the funding lifecycle rather than to
 * the form: the wizard's job ends when it hands over a valid set of values.
 */
import { useState } from 'react'
import {
  WIZARD_STEPS,
  firstUnsatisfiedStep,
  stepCounter,
  wizardStepMissingRequirement,
} from './gig-form/wizard-steps'
import { WizardRail } from './gig-form/WizardRail'
import { WizardNav } from './gig-form/WizardNav'
import {
  BriefStep,
  CategoryStep,
  MoneyStep,
  ProofTakingStep,
  WhereWhenStep,
} from './gig-form/steps'
import { ModerationHint } from './gig-form/ModerationHint'
import { PriceWarningDialog } from '@/components/moderation/PriceWarningDialog'
import { useGigForm } from '@/hooks/gig/useGigForm'
import type { GigFormValues } from '@tenda/shared'

const LAST_INDEX = WIZARD_STEPS.length - 1

export function GigWizard({
  initialValues,
  onSubmit,
  isLoading,
}: {
  initialValues?: Partial<GigFormValues>
  onSubmit: (values: GigFormValues) => Promise<void>
  isLoading: boolean
}) {
  const form = useGigForm(initialValues, onSubmit)
  const [index, setIndex] = useState(0)
  const step = WIZARD_STEPS[index]
  const finalStep = index === LAST_INDEX

  /**
   * On the last step the whole form is what matters, not just this step: the
   * rail lets the reader go back and empty a field they already filled, and a
   * button that checked only the money step would then be enabled while
   * handleSubmit silently refused.
   *
   * BOTH halves of the hint come from the wizard's own grouping. Taking the
   * requirement from `form.missingRequirement` instead walks MOBILE's step
   * order (budget before duration) while the step name walks the wizard's
   * (duration on "Where and when"), and the two disagree the moment both are
   * unmet — it rendered "Set a budget — go back to Where and when", naming a
   * field that step does not carry. Asking the blocking step what IT is
   * missing keeps the sentence true by construction.
   *
   * This is equivalent to what submit checks precisely because every shared
   * requirement is claimed by some step — the invariant wizard-contract.test
   * pins. If a requirement were ever unclaimed, `firstUnsatisfiedStep` would
   * answer null while the form was still invalid.
   */
  const blockingStep = finalStep ? firstUnsatisfiedStep(form.validationValues) : null
  const missingRequirement = finalStep
    ? blockingStep === null
      ? null
      : wizardStepMissingRequirement(blockingStep, form.validationValues)
    : wizardStepMissingRequirement(index, form.validationValues)

  // Only worth naming when the blocker is a step other than this one.
  const missingOnStep =
    blockingStep !== null && blockingStep !== index ? WIZARD_STEPS[blockingStep].label : undefined

  function goTo(next: number) {
    setIndex(next)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function handleNext() {
    // Unreachable from the UI — the button is disabled on the same condition —
    // and kept so a future caller cannot advance past an unmet requirement.
    if (missingRequirement !== null) return
    if (finalStep) {
      void form.handleSubmit()
      return
    }
    goTo(index + 1)
  }

  return (
    <div className="grid gap-10 lg:grid-cols-[216px_minmax(0,1fr)] lg:gap-14">
      <div className="lg:sticky lg:top-[88px] lg:self-start">
        <WizardRail
          currentIndex={index}
          values={form.validationValues}
          onSelect={(next) => {
            if (!isLoading) goTo(next)
          }}
        />
      </div>

      <section className="min-w-0">
        <p className="font-numeric text-xs font-bold uppercase leading-4 tracking-[0.13em] text-content-tertiary">
          {stepCounter(index)}
        </p>
        <h1 className="mt-3 text-balance font-display text-[30px] font-bold leading-9 tracking-[-0.6px] text-content-primary">
          {step.title}
        </h1>
        <p className="mt-3 max-w-[56ch] text-[15px] leading-[22px] text-content-secondary">
          {step.blurb}
        </p>

        {step.key === 'category' && <CategoryStep form={form} />}
        {step.key === 'brief' && <BriefStep form={form} />}
        {step.key === 'where' && <WhereWhenStep form={form} />}
        {step.key === 'proof' && <ProofTakingStep form={form} />}
        {step.key === 'money' && <MoneyStep form={form} />}

        {/* Advisory on every step: the verdict needs both the words and a
            budget, so pinning it to one step would hide it from the step that
            caused it. */}
        <ModerationHint moderation={form.moderation} />

        <WizardNav
          showBack={index > 0}
          finalStep={finalStep}
          missingRequirement={missingRequirement}
          missingOnStep={missingOnStep}
          loading={isLoading}
          onBack={() => goTo(index - 1)}
          onNext={handleNext}
        />
      </section>

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
