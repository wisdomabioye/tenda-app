'use client'

/**
 * "My Disputes" — web port of mobile's disputes list: a dispute stays
 * findable after its notification is dismissed. Open|Resolved segments;
 * rows deep-link into the mediation thread.
 */
import { useState } from 'react'
import { Scale } from 'lucide-react'
import type { MyDisputeStatus } from '@tenda/shared'
import { MyDisputeRow } from '@/components/dispute'
import { useMyDisputes } from '@/hooks/dispute/useMyDisputes'
import { PaginatedList } from '@/components/shared/PaginatedList'
import { cn } from '@/lib/cn'

const SEGMENTS: { key: MyDisputeStatus; label: string }[] = [
  { key: 'open', label: 'Open' },
  { key: 'resolved', label: 'Resolved' },
]

const EMPTY_COPY: Record<MyDisputeStatus, { title: string; description: string }> = {
  open: { title: 'No open disputes', description: 'Disputes you raise or that are raised against you appear here.' },
  resolved: { title: 'No resolved disputes', description: 'Once a dispute is settled it moves here for your records.' },
}

export default function MyDisputesPage() {
  const [status, setStatus] = useState<MyDisputeStatus>('open')
  const list = useMyDisputes(status)

  return (
    <div className="mx-auto w-full max-w-2xl">
      <h1 className="px-1 pb-3 pt-6 font-display text-2xl font-bold text-content-primary">
        My disputes
      </h1>

      <div className="flex border-b border-border-subtle" role="tablist" aria-label="Dispute status">
        {SEGMENTS.map((seg) => {
          const active = status === seg.key
          return (
            <button
              key={seg.key}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setStatus(seg.key)}
              className={cn(
                'flex-1 border-b-2 py-3 text-sm font-semibold transition-colors',
                active
                  ? 'border-brand-solid text-content-primary'
                  : 'border-transparent text-content-tertiary hover:text-content-secondary',
              )}
            >
              {seg.label}
            </button>
          )
        })}
      </div>

      <div className="pt-4">
        <PaginatedList
          list={list}
          keyOf={(row) => row.dispute_id}
          renderItem={(row) => <MyDisputeRow row={row} />}
          errorTitle="Could not load your disputes"
          empty={
            <div className="flex flex-col items-center gap-3 px-8 py-16 text-center">
              <Scale size={40} className="text-content-secondary" />
              <p className="font-semibold text-content-primary">{EMPTY_COPY[status].title}</p>
              <p className="text-sm text-content-secondary">{EMPTY_COPY[status].description}</p>
            </div>
          }
        />
      </div>
    </div>
  )
}
