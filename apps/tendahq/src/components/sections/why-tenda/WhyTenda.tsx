import { SectionShell } from '@/components/ui/SectionShell'
import { PILLARS, WHY_HEADER } from './content'
import { Pillar } from './Pillar'

/**
 * §06 Why Tenda — light interlude after the dark spine. 4 equal-width pillar
 * cells separated by hairlines. Each pillar leads with a proof artifact, not
 * a platitude.
 */
export function WhyTenda() {
  return (
    <SectionShell id="why" tone="light" padY="lg">
      <Header />

      <div className="mt-14 grid divide-y divide-[var(--border-subtle)] overflow-hidden rounded-3xl border border-[var(--border-default)] bg-[var(--surface-card)] sm:grid-cols-2 sm:divide-x sm:divide-y-0 lg:grid-cols-4">
        {PILLARS.map((pillar, i) => (
          <div
            key={pillar.num}
            className={
              // sm-grid: row 1 needs bottom border to mimic the divider when 2-col
              i < 2 ? 'sm:border-b sm:border-[var(--border-subtle)] lg:border-b-0' : undefined
            }
          >
            <Pillar pillar={pillar} />
          </div>
        ))}
      </div>
    </SectionShell>
  )
}

function Header() {
  return (
    <div className="grid gap-10 lg:grid-cols-[1.1fr_0.9fr] lg:gap-12">
      <div>
        <p className="eyebrow text-[var(--content-tertiary)]">
          <span className="mono font-semibold text-[var(--accent)]">{WHY_HEADER.eyebrow.num}</span>
          <span className="mx-2 opacity-60">·</span>
          {WHY_HEADER.eyebrow.label}
        </p>
        <h2 className="h1 mt-4 text-[var(--content-primary)]">
          {WHY_HEADER.h2.line1}
          <br />
          <span className="text-[var(--content-tertiary)]">{WHY_HEADER.h2.dim}</span>
        </h2>
      </div>
      <p className="body-lg text-[var(--content-secondary)] lg:mt-2">{WHY_HEADER.sub}</p>
    </div>
  )
}
