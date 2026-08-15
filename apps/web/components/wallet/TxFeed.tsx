/**
 * Day-grouped, role-scoped transaction feed (web port of mobile's TxRow +
 * feed rendering). WHICH rows arrive is the server's call (shared
 * TX_FEED_VISIBILITY); the shared tx-copy module words and signs each row
 * from the viewer's side.
 */
import {
  formatRelativeDayWithTime,
  txDisplayAmount,
  txLabel,
  txSign,
  viewerRole,
  type DayGroupHeader,
  type DayGroupItem,
  type UserEscrowTransaction,
} from '@tenda/shared'
import { Button } from '@/components/ui'
import { cn } from '@/lib/cn'

/** Exactly groupByDay's output — the shared types, never a local re-statement. */
type FeedEntry = DayGroupHeader<'tx'> | DayGroupItem<UserEscrowTransaction, 'tx'>

function TxRow({ tx, userId }: { tx: UserEscrowTransaction; userId: string }) {
  const role = viewerRole(tx, userId)
  const label = txLabel(tx.escrow.kind, tx.type, role)
  const sign = txSign(tx, role)
  const shown = txDisplayAmount(tx, role)
  return (
    <li className="flex items-center gap-3 rounded-card border border-border-subtle bg-surface-card px-4 py-3">
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="text-sm font-semibold text-content-primary">{label}</span>
        <span className="truncate text-xs text-content-tertiary">
          {tx.escrow.title ?? 'Exchange'}
          {tx.created_at !== null && ` · ${formatRelativeDayWithTime(tx.created_at)}`}
        </span>
      </div>
      {shown !== null && (
        <span
          className={cn(
            'font-numeric text-sm font-semibold',
            sign === '+' && 'text-numeric-positive',
            sign === '-' && 'text-numeric-negative',
            sign === null && 'text-content-secondary',
          )}
        >
          {sign ?? ''}
          {shown.amount.toLocaleString('en-US', { maximumFractionDigits: 6 })} {shown.symbol}
        </span>
      )}
    </li>
  )
}

export function TxFeed({
  feed,
  userId,
  isLoading,
  hasMore,
  isLoadingMore,
  onLoadMore,
}: {
  feed: FeedEntry[]
  userId: string
  isLoading: boolean
  hasMore: boolean
  isLoadingMore: boolean
  onLoadMore: () => void
}) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-xs font-semibold uppercase tracking-wide text-content-tertiary">Activity</h2>
      {feed.length === 0 ? (
        <p className="py-4 text-center text-sm text-content-tertiary">
          {isLoading ? 'Loading transactions…' : 'No transactions yet.'}
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {feed.map((entry) =>
            entry.type === 'day' ? (
              <li key={entry.key} className="pt-2 text-xs font-semibold text-content-tertiary">
                {entry.label}
              </li>
            ) : (
              <TxRow key={entry.key} tx={entry.item} userId={userId} />
            ),
          )}
        </ul>
      )}
      {hasMore && (
        <Button variant="ghost" size="md" disabled={isLoadingMore} onClick={onLoadMore}>
          {isLoadingMore ? 'Loading…' : 'Load more'}
        </Button>
      )}
    </section>
  )
}
