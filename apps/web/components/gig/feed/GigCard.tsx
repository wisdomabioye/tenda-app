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
 * wasted trip, beside the settlement CHAIN — the fact that decides whether the
 * reader holds a wallet that can take the gig at all, and the one the feed
 * already filters by without ever naming it on a row.
 */
import Link from 'next/link'
import {
  AGENT_BADGE_LABEL,
  CATEGORY_LABELS,
  acceptWindowState,
  chainLabel,
  displayName,
  formatReviewScore,
  gigPlaceLabel,
  type GigSummary,
} from '@tenda/shared'
import { MapPin } from 'lucide-react'
import { CATEGORY_ICONS, CATEGORY_TONE } from '@/components/gig/category-icons'
import { Avatar } from '@/components/ui/Avatar'
import { Badge } from '@/components/ui/Badge'
import { Eyebrow, RelativeTime } from '@/components/ui'
import { GIG_CARD_COPY, gigTakeVerb } from './card-copy'
import { toGigCardModel, type GigCardModel } from './gig-card-model'

export function GigCard({ gig: input, index }: { gig: GigCardModel | GigSummary; index?: number }) {
  const gig = 'amount_raw' in input ? toGigCardModel(input) : input
  const CategoryIcon = CATEGORY_ICONS[gig.category]
  const tone = CATEGORY_TONE[gig.category]
  const creatorName = displayName(gig.creator.first_name, gig.creator.last_name, gig.creator.id)
  const rating = formatReviewScore(gig.creator.review_score)
  const acceptWindow = acceptWindowState(gig)

  return (
    <Link
      href={`/gig/${gig.escrow_id}`}
      // The feed's keyboard layer walks these; the index makes "the third
      // card" addressable without the enhancement owning a list of ids.
      data-gig-card={index}
      // `min-w-0` is load-bearing, not tidiness. A flex/grid item defaults to
      // `min-width:auto`, i.e. "never shrink below your min-content width" —
      // and `overflow-wrap: break-word` on the title does NOT reduce
      // min-content. So with the default the card sizes to the longest
      // unbreakable token a poster wrote and drags the grid track out with it.
      // Both halves are required: the constraint here, the break opportunity
      // on the text. Measured — `break-words` alone changed nothing.
      className="flex h-full min-w-0 flex-col rounded-card border border-border-subtle bg-surface-card p-5 shadow-card transition-shadow hover:border-border-strong hover:shadow-elevated"
    >
      {/* `flex-wrap` is load-bearing since the chain joined this row, and the
          widths are MEASURED, not guessed (browser, eight viewports): the feed
          grid hands a card 272px at 320, 291px right across the 360-1100 band,
          and 288px once the third column appears at 1280+. Three items fit 291
          on one line; they do not fit 272 or 288, and without the wrap those
          two squeezed the category to "DELIVE…". The 1280 case is the one that
          is easy to miss, because checking only the 320px floor suggests this
          is a small-screen concern and it is not — a card is ~280px wide at
          every viewport. Wrapping drops the badge pair onto its own
          right-aligned line (+22px of row height, uniform across the grid) and
          every label stays whole. Testnet chain names are the long ones
          ("Solana Devnet"); production reads "Solana", "BASE". */}
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
        <CategoryIcon size={16} aria-hidden className={`shrink-0 ${tone.text}`} />
        {/* twMerge lets the category tone win over Eyebrow's default. No
            `truncate` here: every CATEGORY_LABELS entry is one short word, so
            it was verified inert and removed rather than left as a class with
            a comment claiming it mattered. */}
        <Eyebrow as="span" className={tone.text}>
          {CATEGORY_LABELS[gig.category]}
        </Eyebrow>
        {/* The chain, beside the status and not buried in the terms: the feed
            already FILTERS by chain (`?chain_id=`), so a reader who has not
            filtered is otherwise comparing cards that settle on different
            networks with nothing on them saying so — and which chain a gig
            pays on decides whether they hold a wallet that can take it. */}
        <span className="ml-auto flex shrink-0 items-center gap-2">
          <Badge variant="neutral" label={chainLabel(gig.chain_id)} />
          {acceptWindow === 'closing' ? (
            <Badge variant="warning" label={GIG_CARD_COPY.closingSoon} />
          ) : (
            <Badge variant="success" label={GIG_CARD_COPY.open} />
          )}
        </span>
      </div>

      {/* `break-words`: the title is POSTER-WRITTEN and routinely contains a
          pasted link. Without a break opportunity the card grows to fit the
          longest token and blows the grid track out with it — measured at
          +474px on a 360px viewport, and still +30px at 1100px. It only acts
          on words that would otherwise overflow, so ordinary titles are
          untouched. See CLAUDE.md, "text a poster wrote". */}
      <h3 className="mt-3.5 text-pretty break-words font-display text-[17px] font-semibold leading-6 text-content-primary">
        {gig.title}
      </h3>

      <div className="mt-4 flex items-end gap-1.5">
        <span className="font-numeric text-[26px] font-bold leading-7 tracking-[-0.5px] text-utility-money">
          {gig.displayAmount}
        </span>
        {/* A real space between the two halves. Whitespace-only text between
            flex items is not rendered, so this costs nothing visually — but
            without it `textContent` reads "25USDC", which is what a copy-paste
            and any text scraper gets. The accessible name computation inserts
            its own space; nothing else does. */}
        {' '}
        <span className="pb-0.5 font-numeric text-[13px] leading-[18px] text-content-tertiary">
          {gig.displaySymbol}
        </span>
      </div>

      <div className="mt-1.5 flex items-center gap-1.5 text-[13px] leading-[18px] text-content-tertiary">
        <MapPin size={14} aria-hidden className="shrink-0" />
        {/* `min-w-0` for the same reason as the card: `truncate` cannot act on
            a flex item that is not allowed to shrink, and `city` is free text
            a poster typed. */}
        <span className="min-w-0 truncate">{gigPlaceLabel(gig)}</span>
        {gig.created_at !== null && (
          <>
            <span aria-hidden>·</span>
            <RelativeTime iso={gig.created_at} className="whitespace-nowrap font-numeric" />
          </>
        )}
      </div>

      <div className="mt-auto flex items-center gap-2.5 pt-5">
        <Avatar size="sm" name={creatorName} src={gig.creator.avatar_url} />
        <span className="min-w-0 truncate text-[13px] font-semibold leading-[18px] text-content-secondary">
          {creatorName}
        </span>
        {/* Software posted this: said where the name is, with the shared words. */}
        {gig.creator.is_agent && <Badge variant="brand" label={AGENT_BADGE_LABEL} />}
        {rating !== null && (
          <span
            className="shrink-0 whitespace-nowrap font-numeric text-xs leading-4 text-content-tertiary"
            aria-label={GIG_CARD_COPY.ratingLabel(rating)}
          >
            ★ {rating}
          </span>
        )}
        <span className="ml-auto shrink-0 rounded-full bg-surface-inset px-2.5 py-1 text-xs font-bold text-content-secondary">
          {gigTakeVerb(gig.requires_approval)}
        </span>
      </div>
    </Link>
  )
}
