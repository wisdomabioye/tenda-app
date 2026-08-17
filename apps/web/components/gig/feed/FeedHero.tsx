/**
 * The feed's masthead (Tier 1 comp, lines 393-399). Static — it says what
 * escrow means for someone who has never used the product, which is the one
 * thing an anonymous visitor needs before the cards make sense.
 *
 * The market line is DERIVED, not typed. The comp lists three countries; the
 * three it lists are the payout markets, and the location vocabulary a gig can
 * be posted in is a different, longer list (see FeedRail). Naming the payout
 * markets in a bare eyebrow would read as "we only operate here", so the
 * prefix states which claim is being made.
 */
import { Eyebrow } from '@/components/ui'
import { payoutMarketNames } from '@/lib/markets'
import { FEED_COPY } from './copy'

export function FeedHero() {
  return (
    <section className="border-b border-border-subtle">
      <div className="mx-auto w-full max-w-content px-6 pb-11 pt-16">
        <Eyebrow className="mb-5">
          {FEED_COPY.hero.marketsPrefix} {payoutMarketNames().join(' · ')}
        </Eyebrow>
        <h1 className="max-w-[15ch] text-balance font-display text-[34px] font-bold leading-[38px] tracking-[-1.3px] text-content-primary sm:text-[50px] sm:leading-[54px]">
          {FEED_COPY.hero.title}
        </h1>
        <p className="mt-5 max-w-[58ch] text-[17px] leading-[26px] text-content-secondary">
          {FEED_COPY.hero.lede}
        </p>
      </div>
    </section>
  )
}
