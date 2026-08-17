'use client'

/**
 * My Gigs — web port of mobile's tab: Posted | Working | Applications
 * (plain tabs — the mobile PagerTabBar rework was REVERTED, do not port
 * it), each chip reading its list's server `total`. Drafts are excluded
 * from Posted by construction and surfaced by the banner instead.
 */
import { useState } from 'react'
import Link from 'next/link'
import { ClipboardList, FileClock } from 'lucide-react'
import { applicationStatusLine, type MyApplication } from '@tenda/shared'
import { useMyGigs } from '@/hooks/gig/useMyGigs'
import { useNow } from '@/hooks/timing/useNow'
import { MyGigCard } from '@/components/gig/MyGigCard'
import { GigStatusBadge } from '@/components/escrow/StatusBadge'
import { ChainFilterChips } from '@/components/shared/ChainFilterChips'
import { PaginatedList } from '@/components/shared/PaginatedList'
import { cn } from '@/lib/cn'

type TabKey = 'posted' | 'working' | 'applications'

function EmptyState({ title, description }: { title: string; description: string }) {
  return (
    <div className="flex flex-col items-center gap-3 px-8 py-16 text-center">
      <ClipboardList size={40} className="text-content-secondary" />
      <p className="font-semibold text-content-primary">{title}</p>
      <p className="text-sm text-content-secondary">{description}</p>
    </div>
  )
}

function ApplicationRow({ row, nowMs }: { row: MyApplication; nowMs: number }) {
  // Mount-time clock (web useNow contract) — the line re-derives on refetch.
  const expiresIn =
    row.application.expires_at !== null
      ? Math.floor((new Date(row.application.expires_at).getTime() - nowMs) / 1000)
      : null
  return (
    <Link
      href={`/gig/${row.gig.escrow_id}`}
      className="flex flex-col gap-1 rounded-card border border-border-subtle bg-surface-card px-4 py-3 transition-colors hover:bg-surface-inset"
    >
      <span className="flex items-center gap-2">
        <span className="min-w-0 flex-1 truncate text-[15px] font-semibold text-content-primary">
          {row.gig.title}
        </span>
        <GigStatusBadge status={row.gig.status} />
      </span>
      <span className="text-xs text-content-secondary">
        {applicationStatusLine(row.application.status, expiresIn)}
      </span>
    </Link>
  )
}

export default function MyGigsPage() {
  const [tab, setTab] = useState<TabKey>('posted')
  const { posted, working, drafts, applications, chainId, setChainId } = useMyGigs()
  const nowMs = useNow()

  const TABS: { key: TabKey; label: string; total: number | null }[] = [
    { key: 'posted', label: 'Posted', total: posted.hasFetched ? posted.total : null },
    { key: 'working', label: 'Working', total: working.hasFetched ? working.total : null },
    {
      key: 'applications',
      label: 'Applied',
      total: applications.hasFetched ? applications.total : null,
    },
  ]

  return (
    <div className="mx-auto w-full max-w-2xl">
      <h1 className="px-1 pb-3 pt-6 font-display text-2xl font-bold text-content-primary">My gigs</h1>

      {drafts.hasFetched && drafts.total > 0 && (
        <Link
          href="/my-gigs/drafts"
          className="mb-3 flex items-center gap-2.5 rounded-card border border-border-subtle bg-surface-inset px-4 py-3 text-sm transition-opacity hover:opacity-80"
        >
          <FileClock size={16} className="shrink-0 text-content-secondary" />
          <span className="flex-1 text-content-primary">
            <span className="font-semibold">
              {drafts.total} draft{drafts.total === 1 ? '' : 's'}
            </span>{' '}
            waiting to be funded
          </span>
          <span className="font-semibold text-brand-primary">Open</span>
        </Link>
      )}

      <div className="flex border-b border-border-subtle" role="tablist" aria-label="My gigs lists">
        {TABS.map((t) => {
          const active = tab === t.key
          return (
            <button
              key={t.key}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setTab(t.key)}
              className={cn(
                'flex flex-1 items-center justify-center gap-1.5 border-b-2 py-3 text-sm font-semibold transition-colors',
                active
                  ? 'border-brand-solid text-content-primary'
                  : 'border-transparent text-content-tertiary hover:text-content-secondary',
              )}
            >
              {t.label}
              {t.total !== null && (
                <span className="rounded-full bg-surface-inset px-1.5 font-numeric text-[11px] text-content-secondary">
                  {t.total}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* ONE control shared by the gig tabs (mobile structure): applications
          are caller-scoped with no chain parameter, so the chips only steer
          Posted/Working. */}
      <ChainFilterChips value={chainId} onChange={setChainId} />

      <div className="pt-4">
        {tab === 'posted' && (
          <PaginatedList
            list={posted}
            keyOf={(gig) => gig.escrow_id}
            renderItem={(gig) => <MyGigCard gig={gig} />}
            errorTitle="Could not load your posted gigs"
            empty={<EmptyState title="Nothing posted yet" description="Gigs you post appear here once funded." />}
          />
        )}
        {tab === 'working' && (
          <PaginatedList
            list={working}
            keyOf={(gig) => gig.escrow_id}
            renderItem={(gig) => <MyGigCard gig={gig} />}
            errorTitle="Could not load your working gigs"
            empty={<EmptyState title="Nothing in progress" description="Gigs you accept or win appear here." />}
          />
        )}
        {tab === 'applications' && (
          <PaginatedList
            list={applications}
            keyOf={(row) => row.application.id}
            renderItem={(row) => <ApplicationRow row={row} nowMs={nowMs} />}
            errorTitle="Could not load your applications"
            empty={<EmptyState title="No applications" description="Gigs you apply to appear here while the poster decides." />}
          />
        )}
      </div>
    </div>
  )
}
