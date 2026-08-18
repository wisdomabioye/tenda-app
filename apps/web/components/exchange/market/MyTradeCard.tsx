'use client'

/**
 * One row of "My trades" — the reader's own exchange escrows, from
 * `/v1/users/:id/escrows?kind=exchange`.
 *
 * That endpoint answers `EscrowListRow`, whose `title` is documented as NULL
 * for exchanges (it is `gig_details.title`). The previous row printed exactly
 * that field, so every trade in this list had a blank headline. A trade's
 * headline is its money: what is locked, and which currency it settles in.
 *
 * The rate is NOT here, and cannot be: this wire carries no `rate` or
 * `fiat_amount`. The offer page has both.
 */
import Link from 'next/link'
import { ChevronRight } from 'lucide-react'
import {
  chainLabel,
  formatAssetAmount,
  formatRelativeShort,
  type EscrowListRow,
} from '@tenda/shared'
import { ExchangeStatusBadge } from '@/components/escrow/StatusBadge'
import { cn } from '@/lib/cn'
import { EXCHANGE_COPY, EXCHANGE_ROW_CLASS } from './copy'

export function MyTradeCard({ row, userId }: { row: EscrowListRow; userId: string }) {
  const selling = row.creator_id === userId
  const amount = formatAssetAmount(row.amount_raw, row.asset)

  return (
    <Link
      href={`/exchange/${row.id}`}
      className={cn(EXCHANGE_ROW_CLASS, 'flex items-center gap-4')}
    >
      <span className="min-w-0 flex-1">
        <span className="flex items-baseline gap-2 font-numeric text-[17px] font-bold leading-6 text-content-primary">
          {amount}
          {row.fiat_currency !== null && (
            <>
              <span aria-hidden className="text-content-tertiary">
                →
              </span>
              <span className="text-content-secondary">{row.fiat_currency}</span>
            </>
          )}
        </span>
        <span className="mt-1 block truncate text-[13px] leading-[18px] text-content-secondary">
          {EXCHANGE_COPY.side(selling)} · {chainLabel(row.chain_id)}
          {row.created_at !== null && ` · ${formatRelativeShort(row.created_at)}`}
        </span>
      </span>
      <ExchangeStatusBadge status={row.status} />
      <ChevronRight size={18} aria-hidden className="shrink-0 text-content-tertiary" />
    </Link>
  )
}
