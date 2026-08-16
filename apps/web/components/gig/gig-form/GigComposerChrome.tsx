'use client'

/**
 * The composer's chrome — web twins of mobile's GigComposerProgress (step
 * pills + the active step's title/subtitle) and GigComposerNavigation
 * (Back/Continue with the first-actionable-requirement hint).
 */
import { GIG_COMPOSER_STEPS, type GigComposerStep } from '@tenda/shared'
import { cn } from '@/lib/cn'
import { Button } from '@/components/ui/Button'

export function GigComposerProgress({
  step,
  onStepPress,
}: {
  step: GigComposerStep
  onStepPress: (index: number) => void
}) {
  const active = GIG_COMPOSER_STEPS.findIndex((s) => s.key === step)
  const current = GIG_COMPOSER_STEPS[active]
  return (
    <div className="flex flex-col gap-3">
      <div className="flex gap-2" role="tablist" aria-label="Steps">
        {GIG_COMPOSER_STEPS.map((s, index) => (
          <button
            key={s.key}
            type="button"
            role="tab"
            aria-selected={index === active}
            onClick={() => onStepPress(index)}
            className={cn(
              'flex-1 rounded-control border px-3 py-2 text-xs font-semibold',
              index === active
                ? 'border-brand-primary bg-brand-primary-surface text-brand-primary'
                : index < active
                  ? 'border-border-default bg-surface-card text-content-primary'
                  : 'border-border-default bg-surface-card text-content-tertiary',
            )}
          >
            {index + 1}. {s.label}
          </button>
        ))}
      </div>
      <div>
        <h2 className="font-display text-xl font-bold text-content-primary">{current.title}</h2>
        <p className="text-sm text-content-secondary">{current.subtitle}</p>
      </div>
    </div>
  )
}

export function GigComposerNavigation({
  firstStep,
  finalStep,
  missingRequirement,
  submitLabel,
  loading,
  onBack,
  onContinue,
}: {
  firstStep: boolean
  finalStep: boolean
  missingRequirement: string | null
  submitLabel: string
  loading: boolean
  onBack: () => void
  onContinue: () => void
}) {
  const hint = missingRequirement !== null
    ? `${missingRequirement} to ${finalStep ? 'post your gig' : 'continue'}`
    : null

  return (
    <div className="flex flex-col gap-2">
      {hint !== null && <p className="text-center text-xs text-content-tertiary">{hint}</p>}
      <div className="flex gap-2">
        {!firstStep && (
          <Button variant="outline" size="lg" className="flex-[0.38]" disabled={loading} onClick={onBack}>
            Back
          </Button>
        )}
        <Button
          variant="primary"
          size="lg"
          className="flex-1"
          disabled={missingRequirement !== null || loading}
          onClick={onContinue}
        >
          {loading ? 'Working…' : finalStep ? submitLabel : 'Continue'}
        </Button>
      </div>
    </div>
  )
}
