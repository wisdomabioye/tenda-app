'use client'

/**
 * The wizard's step rail (comp: 216px, sticky). Each entry is a real button:
 * the reader can jump back to any step they have satisfied, which is the only
 * way to correct an earlier answer without losing the later ones.
 *
 * A locked step is `disabled` rather than hidden — the reader can see what is
 * still ahead of them, and the sub-line says what each one is for.
 */
import { Check } from 'lucide-react'
import { cn } from '@/lib/cn'
import { WIZARD_STEPS, wizardRailState } from './wizard-steps'
import type { GigValidationValues } from '@tenda/shared'

export function WizardRail({
  currentIndex,
  values,
  onSelect,
}: {
  currentIndex: number
  values: GigValidationValues
  onSelect: (index: number) => void
}) {
  return (
    <nav aria-label="Post a gig" className="flex flex-col gap-0.5">
      <p className="mb-3.5 font-numeric text-xs font-medium uppercase leading-4 tracking-[0.13em] text-content-tertiary">
        Post a gig
      </p>
      {WIZARD_STEPS.map((step, index) => {
        const { current, done, locked } = wizardRailState(index, currentIndex, values)
        return (
          <button
            key={step.key}
            type="button"
            disabled={locked}
            aria-current={current ? 'step' : undefined}
            onClick={() => onSelect(index)}
            className={cn(
              'flex items-center gap-3 rounded-md px-3 py-2.5 text-left transition-colors',
              current && 'bg-surface-inset',
              !current && !locked && 'hover:bg-surface-inset',
              locked && 'cursor-not-allowed opacity-45',
            )}
          >
            <span
              aria-hidden
              className={cn(
                'flex size-6 shrink-0 items-center justify-center rounded-full border text-[11px] font-bold',
                done && 'border-brand-primary bg-brand-primary text-content-on-brand',
                current && !done && 'border-brand-primary text-brand-primary',
                !done && !current && 'border-border-default text-content-tertiary',
              )}
            >
              {done ? <Check size={13} strokeWidth={3} /> : index + 1}
            </span>
            <span className="min-w-0 flex-1">
              <span
                className={cn(
                  'block text-sm font-semibold leading-5',
                  current ? 'text-content-primary' : 'text-content-secondary',
                )}
              >
                {step.label}
              </span>
              <span className="block truncate text-xs leading-4 text-content-tertiary">
                {step.hint}
              </span>
            </span>
          </button>
        )
      })}
    </nav>
  )
}
