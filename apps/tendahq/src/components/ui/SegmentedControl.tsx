import { useId } from 'react'
import { cn } from '@/lib/cn'

export interface SegmentOption<T extends string> {
  value: T
  label: string
}

interface Props<T extends string> {
  options: readonly SegmentOption<T>[]
  value: T
  onChange: (next: T) => void
  ariaLabel: string
  className?: string
}

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  ariaLabel,
  className,
}: Props<T>) {
  const groupId = useId()

  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className={cn(
        'inline-flex items-center gap-1 rounded-2xl border border-[var(--border-default)] bg-[var(--surface-card)] p-1',
        className,
      )}
    >
      {options.map((opt) => {
        const isActive = opt.value === value
        return (
          <button
            key={opt.value}
            type="button"
            role="radio"
            id={`${groupId}-${opt.value}`}
            aria-checked={isActive}
            onClick={() => onChange(opt.value)}
            className={cn(
              'min-w-[120px] rounded-xl px-4 py-2 text-sm font-semibold transition-colors',
              isActive
                ? 'bg-[var(--brand)] text-[var(--brand-on)]'
                : 'text-[var(--content-secondary)] hover:text-[var(--content-primary)]',
            )}
          >
            {opt.label}
          </button>
        )
      })}
    </div>
  )
}
