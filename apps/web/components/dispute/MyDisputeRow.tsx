'use client'

/**
 * One row in the "My Disputes" list — web twin of mobile's MyDisputeRow.
 * Presentational; kind-aware status badge + shared winner label so nothing
 * is hardcoded per call site.
 */
import Link from 'next/link'
import { ChevronRight } from 'lucide-react'
import { winnerLabel, formatRelativeShort, type MyDisputeRow as MyDisputeRowData } from '@tenda/shared'
import { EscrowStatusBadge } from '@/components/escrow/StatusBadge'

export function MyDisputeRow({ row }: { row: MyDisputeRowData }) {
  const subject = row.subject_title ?? (row.kind === 'gig' ? 'Gig' : 'Currency exchange')
  const withWhom = row.counterparty_name ?? 'the other party'
  const raisedHint = row.raised_by_me ? 'You raised this' : 'Raised against you'
  const isResolved = row.resolved_at !== null

  return (
    <Link
      href={`/dispute/${row.escrow_id}`}
      aria-label={`Open dispute: ${subject}`}
      className="flex items-center gap-2 rounded-xl border border-border-subtle bg-surface-inset px-4 py-3 transition-opacity hover:opacity-80"
    >
      <span className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="flex items-center gap-2">
          <span className="min-w-0 flex-1 truncate text-[15px] font-semibold text-content-primary">
            {subject}
          </span>
          <EscrowStatusBadge status={row.status} kind={row.kind} />
        </span>

        <span className="truncate text-xs text-content-secondary">
          {withWhom} · {raisedHint}
        </span>

        <span className="flex items-center justify-between gap-2">
          <span className="text-xs text-content-tertiary">
            {row.raised_at !== null ? formatRelativeShort(row.raised_at) : ''}
          </span>
          {isResolved && row.winner !== null && (
            <span className="text-xs font-semibold text-content-secondary">
              Outcome: {winnerLabel(row.kind, row.winner)}
            </span>
          )}
        </span>
      </span>

      <ChevronRight size={18} className="shrink-0 text-content-tertiary" />
    </Link>
  )
}
