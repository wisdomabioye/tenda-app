import { SectionShell, type LandingSectionProps } from '@/components/ui/SectionShell'
import { Eyebrow } from '@/components/ui/Eyebrow'
import { ECOSYSTEM_PANELS, ECOSYSTEMS_HEADER } from '@/content'
import { EcosystemPanel } from './EcosystemPanel'

/**
 * §06 Ecosystems — one panel per supported chain, identity derived from the
 * shared chain manifest.
 */
export function Ecosystems({ surface }: LandingSectionProps) {
  return (
    <SectionShell id="ecosystems" surface={surface} padY="lg">
      <div className="mb-12 flex max-w-[62ch] flex-col gap-4">
        <Eyebrow tone="brand" dot>
          {ECOSYSTEMS_HEADER.eyebrow}
        </Eyebrow>
        <h2 className="h1 text-[var(--content-primary)]">
          {ECOSYSTEMS_HEADER.h2.lead}{' '}
          <span className="text-[var(--brand)]">{ECOSYSTEMS_HEADER.h2.emphasis}</span>
        </h2>
        <p className="body-lg text-[var(--content-secondary)]">{ECOSYSTEMS_HEADER.sub}</p>
      </div>

      {/* Featured-first: the lead panel (0G — panel order is the content
          file's contract) spans the full top row, the rest sit three-up
          beneath. Four equal panels in a 3-col grid left the fourth alone on
          its own row; this both fixes that and makes the lead VISUAL, not
          just first-in-order. */}
      <div className="grid gap-5 lg:grid-cols-3">
        {ECOSYSTEM_PANELS.map((panel, index) => (
          <EcosystemPanel
            key={panel.chainFamily}
            panel={panel}
            featured={index === 0}
            className={index === 0 ? 'lg:col-span-3' : undefined}
          />
        ))}
      </div>
    </SectionShell>
  )
}
