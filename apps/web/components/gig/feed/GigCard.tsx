/**
 * The feed card (Tier 1 comp, lines 520-543). Listing fields only — the
 * public feed serves anonymous readers, and nothing party-scoped exists on
 * `GigSummary` to leak.
 *
 * `requires_approval` decides whether the action reads Apply or Accept, and it
 * is shown while BROWSING on purpose (shared GigSummary doc): finding out
 * after tapping Accept is a bait-and-switch.
 *
 * The comp's top-right slot holds `statusLabel`. Every gig in this feed is
 * `open` by construction — the server admits no other status — so a status
 * badge here would be a constant. It carries the accept WINDOW instead, which
 * is the one thing about an open gig that changes and can cost the reader a
 * wasted trip.
 */
import Link from 'next/link'
import {
  CATEGORY_LABELS,
  acceptWindowState,
  displayName,
  formatRelativeShort,
  formatReviewScore,
  gigPlaceLabel,
  splitAssetAmount,
  type GigSummary,
} from '@tenda/shared'
import { MapPin } from 'lucide-react'
import { CATEGORY_ICONS, CATEGORY_TONE } from '@/components/gig/category-icons'
import { Avatar } from '@/components/ui/Avatar'
import { Badge } from '@/components/ui/Badge'
import { Eyebrow } from '@/components/ui'
import { GIG_CARD_COPY } from './card-copy'

export function GigCard({ gig, index }: { gig: GigSummary; index?: number }) {
  const CategoryIcon = CATEGORY_ICONS[gig.category]
  const tone = CATEGORY_TONE[gig.category]
  const { amount, symbol } = splitAssetAmount(gig.amount_raw, gig.asset)
  const creatorName = displayName(gig.creator.first_name, gig.creator.last_name, gig.creator.id)
  const rating = formatReviewScore(gig.creator.review_score)
  const window = acceptWindowState(gig)

  return (
    <Link
      href={`/gig/${gig.escrow_id}`}
      // The feed's keyboard layer walks these; the index makes "the third
      // card" addressable without the enhancement owning a list of ids.
      data-gig-card={index}
      className="flex h-full flex-col rounded-card border border-border-subtle bg-surface-card p-5 shadow-card transition-shadow hover:border-border-strong hover:shadow-elevated"
    >
      <div className="flex items-center gap-2">
        <CategoryIcon size={16} aria-hidden className={`shrink-0 ${tone.text}`} />
        {/* twMerge lets the category tone win over Eyebrow's default. */}
        <Eyebrow as="span" className={tone.text}>
          {CATEGORY_LABELS[gig.category]}
        </Eyebrow>
        <span className="ml-auto">
          {window === 'closing' ? (
            <Badge variant="warning" label={GIG_CARD_COPY.closingSoon} />
          ) : (
            <Badge variant="success" label={GIG_CARD_COPY.open} />
          )}
        </span>
      </div>

      <h3 className="mt-3.5 text-pretty font-display text-[17px] font-semibold leading-6 text-content-primary">
        {gig.title}
      </h3>

      <div className="mt-4 flex items-end gap-1.5">
        <span className="font-numeric text-[26px] font-bold leading-7 tracking-[-0.5px] text-utility-money">
          {amount}
        </span>
        {/* A real space between the two halves. Whitespace-only text between
            flex items is not rendered, so this costs nothing visually — but
            without it `textContent` reads "25USDC", which is what a copy-paste
            and any text scraper gets. The accessible name computation inserts
            its own space; nothing else does. */}
        {' '}
        <span className="pb-0.5 font-numeric text-[13px] leading-[18px] text-content-tertiary">
          {symbol}
        </span>
      </div>

      <div className="mt-1.5 flex items-center gap-1.5 text-[13px] leading-[18px] text-content-tertiary">
        <MapPin size={14} aria-hidden className="shrink-0" />
        <span className="truncate">{gigPlaceLabel(gig)}</span>
        {gig.created_at !== null && (
          <>
            <span aria-hidden>·</span>
            <span className="whitespace-nowrap font-numeric">
              {formatRelativeShort(gig.created_at)}
            </span>
          </>
        )}
      </div>

      <div className="mt-auto flex items-center gap-2.5 pt-5">
        <Avatar size="sm" name={creatorName} src={gig.creator.avatar_url} />
        <span className="min-w-0 truncate text-[13px] font-semibold leading-[18px] text-content-secondary">
          {creatorName}
        </span>
        {rating !== null && (
          <span
            className="shrink-0 whitespace-nowrap font-numeric text-xs leading-4 text-content-tertiary"
            aria-label={GIG_CARD_COPY.ratingLabel(rating)}
          >
            ★ {rating}
          </span>
        )}
        <span className="ml-auto shrink-0 rounded-full bg-surface-inset px-2.5 py-1 text-xs font-bold text-content-secondary">
          {gig.requires_approval ? GIG_CARD_COPY.apply : GIG_CARD_COPY.accept}
        </span>
      </div>
    </Link>
  )
}
