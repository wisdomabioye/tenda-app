/**
 * The wordmark: a filled tile carrying the product's initial, then the name.
 * Every comp opens with it — the public header, the auth shell, the wizard —
 * so it is one component rather than a repeated pair of spans.
 *
 * The initial is DERIVED from the shared product name, not typed: a rename
 * that reached the wordmark but not the tile would ship a "T" beside some
 * other word.
 */
import Link from 'next/link'
import { APP_INFO } from '@tenda/shared'
import { cn } from '@/lib/cn'

/**
 * The tile alone, at whatever size the surface needs — 26px inside the
 * wordmark, 56px as the welcome screen's hero mark (Auth comp, line 442).
 * Exported so the hero cannot drift into a second definition of the mark.
 */
export function BrandTile({ size = 26, className }: { size?: number; className?: string }) {
  return (
    <span
      aria-hidden
      style={{ width: size, height: size, fontSize: Math.round(size * 0.46) }}
      className={cn(
        'inline-flex items-center justify-center rounded-xs bg-brand-solid font-display font-bold text-brand-on-primary',
        // The hero mark is big enough that the wordmark's 4px corner reads as
        // a square; the comp rounds it to 16px there.
        size >= 40 && 'rounded-2xl',
        className,
      )}
    >
      {APP_INFO.name.charAt(0)}
    </span>
  )
}

export function BrandMark({ href = '/gigs', className }: { href?: string; className?: string }) {
  return (
    <Link
      href={href}
      className={cn('flex items-center gap-2.5 text-content-primary', className)}
    >
      <BrandTile />
      <span className="font-display text-[19px] font-bold tracking-[-0.4px]">{APP_INFO.name}</span>
    </Link>
  )
}
