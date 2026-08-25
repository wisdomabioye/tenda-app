/**
 * One review row — web twin of mobile's ReviewCard, tolerant of an
 * ANONYMOUS reviewer: the profile list endpoint serves bare review rows
 * (no reviewer identity), while escrow-detail call sites can supply one.
 */
import { Star } from 'lucide-react'
import { formatFullName, type Review } from '@tenda/shared'
import { Avatar } from '@/components/ui/Avatar'
import { RelativeTime } from '@/components/ui/RelativeTime'
import { cn } from '@/lib/cn'

export function ReviewCard({
  review,
  reviewer,
  label,
}: {
  review: Review
  reviewer?: { first_name: string | null; last_name: string | null; avatar_url: string | null }
  label?: string
}) {
  const name = reviewer
    ? formatFullName(reviewer.first_name, reviewer.last_name) || 'Anonymous'
    : 'Counterparty'

  return (
    <div className="flex items-start gap-2.5 border-b border-border-subtle px-1 py-3.5">
      <Avatar size="sm" name={name} src={reviewer?.avatar_url ?? null} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="min-w-0 shrink truncate text-sm font-semibold text-content-primary">{name}</span>
          <span className="flex shrink-0 gap-px" aria-label={`${review.score} of 5 stars`}>
            {Array.from({ length: 5 }).map((_, i) => (
              <Star
                key={i}
                size={12}
                className={cn(
                  'text-accent-primary',
                  i < review.score ? 'fill-accent-primary' : 'fill-transparent',
                )}
                strokeWidth={i < review.score ? 0 : 1.5}
              />
            ))}
          </span>
          {/* `created_at` is non-nullable on the wire, so the guard is only
              against an empty string — which `RelativeTime` would render as
              "Invalid Date". Same check the truthiness test here made before. */}
          {review.created_at !== '' && (
            <RelativeTime
              iso={review.created_at}
              className="ml-auto shrink-0 font-numeric text-[11.5px] text-content-tertiary"
            />
          )}
        </div>
        {review.comment !== null && review.comment !== '' && (
          <p className="mt-1.5 text-[13px] leading-5 text-content-secondary">{review.comment}</p>
        )}
        {label !== undefined && (
          <p className="mt-1.5 font-numeric text-[10px] font-semibold uppercase tracking-wider text-content-tertiary">
            {label}
          </p>
        )}
      </div>
    </div>
  )
}
