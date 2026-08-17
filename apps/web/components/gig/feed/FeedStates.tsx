/**
 * The feed's three non-list states (Tier 1 comp, lines 468-513).
 *
 * They share a file because they are alternatives to one another: whoever
 * changes the wording of "nothing here" should see "nothing loaded" on the
 * same screen, since the difference between them is the whole point. Nothing
 * here is reachable from outside the feed.
 */
import Link from 'next/link'
import { AlertTriangle, RotateCw, SearchX } from 'lucide-react'
import { GIGS_PAGE_SIZE } from '@/lib/gigs/search-params'
import { FEED_COPY } from './copy'

/** The card grid, shared by the list and its skeleton so they cannot drift apart. */
export const FEED_GRID_CLASS =
  'grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3'

export function FeedSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className={FEED_GRID_CLASS} aria-hidden>
      {Array.from({ length: Math.min(count, GIGS_PAGE_SIZE) }, (_, index) => (
        <div
          key={index}
          className="animate-shimmer rounded-card border border-border-subtle bg-surface-card p-5"
        >
          <SkeletonBar className="h-3 w-[38%]" />
          <SkeletonBar className="mt-4 h-[18px] w-[92%]" />
          <SkeletonBar className="mt-2 h-[18px] w-[64%]" />
          <SkeletonBar className="mt-6 h-7 w-[44%]" />
          <SkeletonBar className="mt-6 h-3 w-[70%]" />
        </div>
      ))}
    </div>
  )
}

function SkeletonBar({ className }: { className: string }) {
  return <div className={`rounded-[6px] bg-surface-inset ${className}`} />
}

/**
 * Nothing matched. Two wordings, because "your filters are too narrow" is
 * useless advice to someone who set no filters — and the Clear button would
 * be a link to the page they are already on.
 */
export function FeedEmpty({ filtered }: { filtered: boolean }) {
  return (
    <div className="rounded-card border border-dashed border-border-strong px-8 py-14 text-center">
      <SearchX size={28} aria-hidden className="mx-auto text-content-tertiary" />
      <h3 className="mt-4 font-display text-xl font-semibold leading-[26px] text-content-primary">
        {filtered ? FEED_COPY.empty.title : FEED_COPY.empty.bareTitle}
      </h3>
      <p className="mx-auto mt-2 max-w-[44ch] text-content-secondary">
        {filtered ? FEED_COPY.empty.body : FEED_COPY.empty.bareBody}
      </p>
      {filtered && (
        <Link
          href="/gigs"
          className="mt-5 inline-block rounded-control bg-brand-solid px-[18px] py-2.5 text-sm font-bold text-brand-on-primary hover:brightness-95"
        >
          {FEED_COPY.empty.action}
        </Link>
      )}
    </div>
  )
}

/**
 * The read failed. Says plainly that this is a READ failure — the comp's copy,
 * and it is the right copy: someone whose money is in escrow needs to know an
 * error on this screen has nothing to do with their funds.
 *
 * `retry` comes from the error boundary; the comp links back to /gigs, which
 * would not re-run a failed render.
 */
export function FeedError({ retry }: { retry: () => void }) {
  return (
    <div
      role="alert"
      className="flex items-start gap-4 rounded-card border border-feedback-danger-border bg-feedback-danger-surface p-8"
    >
      <AlertTriangle size={22} aria-hidden className="shrink-0 text-feedback-danger-text" />
      <div>
        <h3 className="font-display text-xl font-semibold leading-[26px] text-feedback-danger-text">
          {FEED_COPY.error.title}
        </h3>
        <p className="mt-2 max-w-[52ch] text-feedback-danger-text opacity-85">
          {FEED_COPY.error.body}
        </p>
        <button
          type="button"
          onClick={retry}
          className="mt-5 inline-flex items-center gap-2 rounded-control bg-feedback-danger-base px-4 py-2.5 text-sm font-bold text-content-inverse hover:brightness-95"
        >
          <RotateCw size={16} aria-hidden />
          {FEED_COPY.error.action}
        </button>
      </div>
    </div>
  )
}
