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

export function BrandMark({ href = '/gigs', className }: { href?: string; className?: string }) {
  return (
    <Link
      href={href}
      className={cn('flex items-center gap-2.5 text-content-primary', className)}
    >
      <span
        aria-hidden
        className="flex h-[26px] w-[26px] items-center justify-center rounded-xs bg-brand-solid font-display text-[15px] font-bold text-brand-on-primary"
      >
        {APP_INFO.name.charAt(0)}
      </span>
      <span className="font-display text-[19px] font-bold tracking-[-0.4px]">{APP_INFO.name}</span>
    </Link>
  )
}
