import { SectionShell } from '@/components/ui/SectionShell'
import { COVERAGE_HEADER } from './content'
import { CoverageMap } from './CoverageMap'

/**
 * §07 Coverage — dark-spine section. Decentralized framing: Tenda runs on
 * Solana, every supported corridor is live wherever a buyer + worker meet.
 * The world map carries the message; we deliberately don't show a "Top
 * markets" sidebar because we have no public-launch data to rank.
 */
export function Coverage() {
  return (
    <SectionShell id="coverage" tone="dark" padY="lg">
      <Header />
      <div className="mt-12">
        <CoverageMap />
      </div>
    </SectionShell>
  )
}

function Header() {
  return (
    <div className="grid gap-10 lg:grid-cols-[1.1fr_0.9fr] lg:gap-12">
      <div>
        <p className="eyebrow text-[var(--content-tertiary)]">
          <span className="mono font-semibold text-[var(--success)]">{COVERAGE_HEADER.eyebrow.num}</span>
          <span className="mx-2 opacity-60">·</span>
          {COVERAGE_HEADER.eyebrow.label}
        </p>
        <h2 className="h1 mt-4 text-[var(--content-primary)]">
          {COVERAGE_HEADER.h2.lead}{' '}
          <span className="text-[var(--success)]">{COVERAGE_HEADER.h2.accent}</span>
          <br />
          <span className="text-[var(--content-tertiary)]">{COVERAGE_HEADER.h2.dim}</span>
        </h2>
      </div>
      <p className="body-lg text-[var(--content-secondary)] lg:mt-2">{COVERAGE_HEADER.sub}</p>
    </div>
  )
}
