import type { ReactNode } from 'react'
import { useIntersect } from '@/hooks/useIntersect'
import { cn } from '@/lib/cn'

export type SectionTone = 'dark' | 'light'

interface Props {
  id?: string
  tone: SectionTone
  /** Constrain inner max-width. Defaults to var(--maxw) = 1280. */
  maxWidth?: 'page' | 'narrow' | 'full'
  /** Vertical padding scale. */
  padY?: 'sm' | 'md' | 'lg'
  /** Disable the entrance reveal — hero already owns its first paint. */
  noReveal?: boolean
  className?: string
  innerClassName?: string
  children: ReactNode
}

const PAD_Y: Record<NonNullable<Props['padY']>, string> = {
  sm: 'py-16 md:py-20',
  md: 'py-20 md:py-28',
  lg: 'py-24 md:py-32',
}

const WIDTH: Record<NonNullable<Props['maxWidth']>, string> = {
  narrow: 'max-w-[960px]',
  page:   'max-w-[var(--maxw)]',
  full:   'max-w-none',
}

/**
 * Wraps a landing section. The `tone` flag pins the section to dark or light
 * regardless of the user's theme — required because the page has a deliberate
 * dark spine (hero/trust/products/escrow/ticker/coverage/faq/cta/footer) with
 * light interludes (why-tenda, three-audiences). See IMPLEMENTATION.md §3.4.
 *
 * Implementation: each section sets `data-theme` locally on its own root, which
 * cascades the token values to children.
 */
export function SectionShell({
  id,
  tone,
  maxWidth = 'page',
  padY = 'md',
  noReveal = false,
  className,
  innerClassName,
  children,
}: Props) {
  const { ref, isVisible } = useIntersect<HTMLDivElement>({ threshold: 0.12 })
  const reveal = !noReveal

  return (
    <section
      id={id}
      data-theme={tone}
      className={cn(
        'relative isolate w-full',
        'bg-[var(--surface-bg)] text-[var(--content-primary)]',
        PAD_Y[padY],
        className,
      )}
    >
      <div
        ref={ref}
        data-visible={reveal ? isVisible || undefined : true}
        className={cn(
          'mx-auto px-5 md:px-8',
          WIDTH[maxWidth],
          reveal && 'reveal-on-scroll',
          innerClassName,
        )}
      >
        {children}
      </div>
    </section>
  )
}
