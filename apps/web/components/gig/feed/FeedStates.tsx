/**
 * Every non-list state the feed can be in: loading, nothing matched, past the
 * last page, and the read failed — twice, because the server-rendered twin
 * exists (see FeedErrorStatic).
 *
 * They share a file because they are alternatives to one another: whoever
 * changes the wording of "nothing here" should see "nothing loaded" on the
 * same screen, since the difference between them is the whole point — and two
 * of these were added precisely because an earlier state was answering for a
 * situation that was not its own. Nothing here is reachable from outside the
 * feed.
 */
import Link from 'next/link'
import { RotateCw, SearchX, Undo2 } from 'lucide-react'
import { ALERT_ACTION_CLASS, AlertPanel } from '@/components/ui/AlertPanel'
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
 * The query matched rows, but this PAGE is past the end of them.
 *
 * A distinct state because the alternative is a lie. A stale link — page three
 * of a search whose results have since been taken, or a cursor whose anchor row
 * is gone — lands on an empty page while `total` still reports matches, and
 * FeedEmpty would tell the reader "no gigs match these filters" about a query
 * that matched twenty. It also drops them back to the unfiltered feed, throwing
 * away the search they typed; this keeps every filter and only rewinds the
 * position.
 */
export function FeedPastEnd({ href, total }: { href: string; total: number }) {
  return (
    <div className="rounded-card border border-dashed border-border-strong px-8 py-14 text-center">
      <Undo2 size={28} aria-hidden className="mx-auto text-content-tertiary" />
      <h3 className="mt-4 font-display text-xl font-semibold leading-[26px] text-content-primary">
        {FEED_COPY.pastEnd.title}
      </h3>
      <p className="mx-auto mt-2 max-w-[44ch] text-content-secondary">
        {FEED_COPY.pastEnd.body(total)}
      </p>
      <Link
        href={href}
        className="mt-5 inline-block rounded-control bg-brand-solid px-[18px] py-2.5 text-sm font-bold text-brand-on-primary hover:brightness-95"
      >
        {FEED_COPY.pastEnd.action}
      </Link>
    </div>
  )
}

/**
 * The read failed. Says plainly that this is a READ failure — the comp's copy,
 * and it is the right copy: someone whose money is in escrow needs to know an
 * error on this screen has nothing to do with their funds.
 *
 * Two shapes, because the two places this appears differ in ONE way: whether a
 * retry callback exists. Inside a client error boundary it does (`reset`).
 * Server-side it does not, and there the retry is simply a fresh GET — which
 * is a real retry, not the no-op the comp's "back to /gigs" link would be
 * inside the boundary.
 */
/** Inside the client error boundary, where `reset` re-runs the segment. */
export function FeedError({ retry }: { retry: () => void }) {
  return (
    <AlertPanel
      title={FEED_COPY.error.title}
      body={FEED_COPY.error.body}
      action={
        <button type="button" onClick={retry} className={ALERT_ACTION_CLASS}>
          <RotateCw size={16} aria-hidden />
          {FEED_COPY.error.action}
        </button>
      }
    />
  )
}

/**
 * The SERVER-rendered twin, and the reason it exists: `error.tsx` is a client
 * component, so its fallback is swapped in by the hydration script. With
 * JavaScript off, a failed feed read rendered a completely BLANK page —
 * measured — on the one surface whose whole premise is that it works without
 * the bundle, at the exact moment a reader needs to be told their escrow is
 * untouched. Same failure shape as the `loading.tsx` Suspense trap this app
 * already documents.
 *
 * `href` is the view the reader was on, so a retry keeps their filters — which
 * `reset()` also does, and a bare link to /gigs would not.
 */
export function FeedErrorStatic({ href }: { href: string }) {
  return (
    <AlertPanel
      title={FEED_COPY.error.title}
      body={FEED_COPY.error.body}
      action={
        <Link href={href} className={ALERT_ACTION_CLASS}>
          <RotateCw size={16} aria-hidden />
          {FEED_COPY.error.action}
        </Link>
      }
    />
  )
}
