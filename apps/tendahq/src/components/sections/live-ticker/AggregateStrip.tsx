import { Placeholder } from '@/components/ui/Placeholder'
import { AGG_CELLS, type AggCell } from './content'
import { cn } from '@/lib/cn'

const TONE_CLASS: Record<AggCell['delta']['tone'], string> = {
  up:      'text-[var(--success)]',
  down:    'text-[var(--success)]',
  neutral: 'text-[var(--content-tertiary)]',
}

export function AggregateStrip() {
  return (
    <div className="mt-6 grid divide-y divide-[var(--border-subtle)] overflow-hidden rounded-2xl border border-[var(--border-default)] bg-[var(--surface-card)] sm:grid-cols-2 sm:divide-x sm:divide-y-0 lg:grid-cols-4">
      {AGG_CELLS.map((cell, i) => (
        <div
          key={cell.k}
          className={cn(
            'flex flex-col gap-1.5 px-5 py-5',
            // sm grid: row 1 cells need bottom borders to mimic the divider when 2-col
            'sm:gap-2',
            i < 2 && 'sm:border-b sm:border-[var(--border-subtle)] lg:border-b-0',
          )}
        >
          <p className="caption uppercase tracking-[0.16em] text-[var(--content-tertiary)]">
            {cell.k}
          </p>
          <p className="mono-large text-[var(--content-primary)]">
            <Placeholder issue={cell.issue}>{cell.v}</Placeholder>
            {cell.unit && (
              <span className="mono-sm ml-1 text-[var(--content-tertiary)]">{cell.unit}</span>
            )}
          </p>
          <p className={cn('mono-sm', TONE_CLASS[cell.delta.tone])}>{cell.delta.text}</p>
        </div>
      ))}
    </div>
  )
}
