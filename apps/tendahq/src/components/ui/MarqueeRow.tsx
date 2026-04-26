import type { ReactNode } from 'react'
import { useReducedMotion } from '@/hooks/useReducedMotion'
import { cn } from '@/lib/cn'

interface Props<T> {
  items: readonly T[]
  /** Render one item. Caller controls width. */
  renderItem: (item: T, index: number) => ReactNode
  /** Loop duration in seconds. */
  speedSec?: number
  direction?: 'left' | 'right'
  /** Pause animation on hover. */
  pauseOnHover?: boolean
  /** Mask gradient at left/right edges. */
  edgeFade?: boolean
  className?: string
  itemClassName?: string
  /** Stable React key off this item field. */
  keyOf: (item: T, index: number) => string | number
}

/**
 * Infinite horizontal marquee. Renders items twice (visually identical) and
 * animates a -50% translate so the seam is invisible. Reduced-motion users get
 * a static, scrollable list.
 */
export function MarqueeRow<T>({
  items,
  renderItem,
  speedSec = 50,
  direction = 'left',
  pauseOnHover = true,
  edgeFade = true,
  className,
  itemClassName,
  keyOf,
}: Props<T>) {
  const reduced = useReducedMotion()
  const animationName = direction === 'left' ? 'marquee-x' : 'marquee-x-reverse'

  const maskStyle = edgeFade
    ? {
        WebkitMaskImage:
          'linear-gradient(to right, transparent 0, black 6%, black 94%, transparent 100%)',
        maskImage:
          'linear-gradient(to right, transparent 0, black 6%, black 94%, transparent 100%)',
      }
    : undefined

  if (reduced) {
    return (
      <div
        className={cn('overflow-x-auto', className)}
        style={maskStyle}
      >
        <div className="flex w-max gap-4">
          {items.map((item, i) => (
            <div key={keyOf(item, i)} className={itemClassName}>
              {renderItem(item, i)}
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div
      className={cn('group relative overflow-hidden', className)}
      style={maskStyle}
    >
      <div
        className={cn(
          'flex w-max gap-4 will-change-transform',
          pauseOnHover && 'group-hover:[animation-play-state:paused]',
        )}
        style={{
          animation: `${animationName} ${speedSec}s linear infinite`,
        }}
      >
        {[...items, ...items].map((item, i) => (
          <div key={`${keyOf(item, i % items.length)}-${i}`} className={itemClassName}>
            {renderItem(item, i % items.length)}
          </div>
        ))}
      </div>
    </div>
  )
}
