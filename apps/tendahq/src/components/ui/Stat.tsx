import type { ReactNode } from 'react'
import { useIntersect } from '@/hooks/useIntersect'
import { cn } from '@/lib/cn'

interface Props {
  /** The value (e.g. "$3.42M", "1.7s", "8,407"). */
  value: ReactNode
  /** Caption beneath the value. */
  label: string
  /** Wrap with the placeholder marker so dev outline + future audit can detect it. */
  placeholder?: boolean
  /** Optional alignment. */
  align?: 'left' | 'center'
  className?: string
}

/**
 * Display a numeric stat. Animates entrance when scrolled into view.
 * Count-up animation is intentionally NOT done here — it requires numeric input
 * and most landing stats are formatted strings ("$3.42M"). For numeric count-ups
 * use `useCountUp` directly.
 */
export function Stat({ value, label, placeholder = false, align = 'left', className }: Props) {
  const { ref, isVisible } = useIntersect<HTMLDivElement>()

  return (
    <div
      ref={ref}
      className={cn(
        'flex flex-col gap-2',
        align === 'center' && 'items-center text-center',
        'transition-[opacity,transform] duration-[480ms] ease-out',
        isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2',
        className,
      )}
    >
      <span className="mono-large text-[var(--content-primary)]" data-placeholder={placeholder || undefined}>
        {value}
      </span>
      <span className="caption uppercase text-[var(--content-tertiary)]">{label}</span>
    </div>
  )
}
