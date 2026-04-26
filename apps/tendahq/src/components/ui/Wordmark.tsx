import { cn } from '@/lib/cn'

type WordmarkSize = 'sm' | 'md' | 'lg' | 'xl'

interface Props {
  size?: WordmarkSize
  className?: string
  /** Override the brand period colour (defaults to var(--live-bright) green). */
  periodColor?: string
}

const SIZES: Record<WordmarkSize, string> = {
  sm: 'text-lg leading-none tracking-[-0.02em]',
  md: 'text-2xl leading-none tracking-[-0.025em]',
  lg: 'text-3xl leading-none tracking-[-0.03em]',
  xl: 'text-5xl leading-none tracking-[-0.035em]',
}

/**
 * The recurring brand wordmark: `tenda` in the display font with a green period.
 * The period colour is the live-bright green and serves as the persistent brand
 * mark across nav, footer, auth, and the trust band. Wireframe contract — see
 * IMPLEMENTATION.md §3.2 ("the green period in `tenda.` is a recurring brand
 * mark; remove it from one place and the system loses cohesion").
 */
export function Wordmark({ size = 'md', className, periodColor }: Props) {
  return (
    <span
      className={cn(
        'inline-flex items-baseline font-bold text-[var(--content-primary)]',
        SIZES[size],
        className,
      )}
      style={{ fontFamily: 'var(--font-display)' }}
      aria-label="Tenda"
    >
      <span aria-hidden>tenda</span>
      <span aria-hidden style={{ color: periodColor ?? 'var(--live-bright)' }}>
        .
      </span>
    </span>
  )
}
