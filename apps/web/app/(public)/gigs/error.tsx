'use client'

import { FeedError } from '@/components/gig/feed/FeedStates'

/**
 * The feed's read failed. A route error boundary rather than a try/catch in
 * the page, so a failure anywhere in the tree — the list query, the chain
 * registry, a card — lands on the same honest message instead of a blank
 * screen or Next's default overlay.
 *
 * `reset` re-runs the failed segment; the comp's "Try again" link points back
 * at /gigs, which is the page the reader is already on and would not re-fetch.
 */
export default function GigsError({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="mx-auto w-full max-w-content px-6 pb-20 pt-8">
      <FeedError retry={reset} />
    </div>
  )
}
