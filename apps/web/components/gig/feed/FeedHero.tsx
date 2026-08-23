/** Compact product context; the shared description prevents marketing drift. */
import { APP_INFO } from '@tenda/shared'

export function FeedHero() {
  return (
    <section className="border-b border-border-subtle">
      <div className="mx-auto w-full max-w-content px-6 py-5">
        <h1 className="text-pretty font-display text-lg font-semibold leading-7 tracking-[-0.2px] text-content-primary sm:text-xl">
          {APP_INFO.description}
        </h1>
      </div>
    </section>
  )
}
