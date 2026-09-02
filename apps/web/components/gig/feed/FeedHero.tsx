/**
 * The public feed's hero — the front door for an anonymous visitor.
 *
 * EVERY string here comes from shared `APP_INFO`, and each is used in the role
 * that file documents for it: the tagline as the brand line, the description
 * as the product summary, the guarantee as the specific right a worker gets.
 * Nothing is retyped — `packages/shared/test/constants/pitch-strings.test.ts`
 * fails if an app hardcodes a value shared already owns, and a locally-written
 * headline here is precisely the drift that guard exists to catch. It is also
 * why `FEED_COPY.hero` was deleted rather than wired up: it held a second,
 * competing headline and lede that nothing rendered.
 *
 * `APP_INFO.guarantee` is the STATIC form of the window. app-info.ts sanctions
 * it for "surfaces that have no config", which this one is — the feed page
 * fetches gigs, facets and chains, not platform config. If this hero ever
 * needs the live window it should read `/v1/platform/config` like the other
 * live surfaces, not interpolate a number here.
 */
import { APP_INFO } from '@tenda/shared'

export function FeedHero() {
  return (
    <section className="border-b border-border-subtle bg-surface-background-alt">
      <div className="mx-auto w-full max-w-content px-6 py-10 sm:py-14">
        <h1 className="max-w-[20ch] text-balance font-display text-[30px] font-semibold leading-9 tracking-[-0.7px] text-content-primary sm:text-[40px] sm:leading-[46px] sm:tracking-[-1px]">
          {APP_INFO.tagline}
        </h1>
        <p className="mt-4 max-w-[54ch] text-[15px] leading-6 text-content-secondary sm:text-base sm:leading-7">
          {APP_INFO.description}
        </p>
        <p className="mt-5 max-w-[48ch] text-[13px] leading-5 text-content-tertiary">
          {APP_INFO.guarantee}
        </p>
      </div>
    </section>
  )
}
