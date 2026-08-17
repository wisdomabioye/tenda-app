'use client'

/**
 * Drafts — the caller's unfunded staging gigs, reached from the banner at
 * the top of My Gigs (web port of mobile's drafts screen). The only
 * surface these rows are reachable from.
 */
import { FileClock } from 'lucide-react'
import { useDraftGigs } from '@/hooks/gig/useDraftGigs'
import { MyGigCard } from '@/components/gig/MyGigCard'
import { PaginatedList } from '@/components/shared/PaginatedList'

export default function DraftsPage() {
  const list = useDraftGigs()

  return (
    <div className="mx-auto w-full max-w-2xl">
      <h1 className="px-1 pb-4 pt-6 font-display text-2xl font-bold text-content-primary">Drafts</h1>
      <PaginatedList
        list={list}
        keyOf={(gig) => gig.escrow_id}
        renderItem={(gig) => <MyGigCard gig={gig} />}
        errorTitle="Could not load your drafts"
        empty={
          <div className="flex flex-col items-center gap-3 px-8 py-16 text-center">
            <FileClock size={40} className="text-content-secondary" />
            <p className="font-semibold text-content-primary">No drafts</p>
            <p className="text-sm text-content-secondary">Gigs you start but do not fund are kept here.</p>
          </div>
        }
      />
    </div>
  )
}
