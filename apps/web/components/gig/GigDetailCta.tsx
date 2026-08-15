import Link from 'next/link'
import type { GigDetail } from '@tenda/shared'
import { buttonVariants } from '@/components/ui'

/**
 * Anonymous-reader CTA. The action itself is Stage 4; here the honest offer
 * is "sign in" — worded by `requires_approval` (Apply vs Accept), and only
 * while the gig is actually open to takers.
 */
export function GigDetailCta({ gig }: { gig: GigDetail }) {
  if (gig.status !== 'open') {
    return (
      <div className="rounded-card border border-border-default bg-surface-inset px-5 py-4 text-sm text-content-secondary">
        This gig is no longer open — its escrow is {gig.status}.
      </div>
    )
  }
  if (gig.is_assigned) {
    return (
      <div className="rounded-card border border-border-default bg-surface-inset px-5 py-4 text-sm text-content-secondary">
        The poster has invited someone for this gig directly.
      </div>
    )
  }
  return (
    <div className="flex items-center justify-between gap-4 rounded-card border border-brand-primary-border bg-brand-primary-surface px-5 py-4">
      <p className="text-sm text-content-secondary">
        {gig.requires_approval
          ? 'The poster picks a worker from applications.'
          : 'First to accept gets the gig.'}
      </p>
      <Link
        href="/signin"
        className={`whitespace-nowrap ${buttonVariants({ size: 'md' })}`}
      >
        {gig.requires_approval ? 'Sign in to apply' : 'Sign in to accept'}
      </Link>
    </div>
  )
}
