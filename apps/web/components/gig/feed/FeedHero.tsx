/**
 * The feed's masthead (Tier 1 comp, lines 393-399). Static — it says what
 * escrow means for someone who has never used the product, which is the one
 * thing an anonymous visitor needs before the cards make sense.
 *
 * Its eyebrow deliberately makes a global product claim rather than deriving a
 * short country list that could imply the marketplace operates only there.
 */
import { Eyebrow } from '@/components/ui'
import { FEED_COPY } from './copy'

export function FeedHero() {
  return (
    <section className="border-b border-border-subtle">
      <div className="mx-auto w-full max-w-content px-6 pb-11 pt-16">
        <Eyebrow className="mb-5">
          {FEED_COPY.hero.eyebrow}
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
