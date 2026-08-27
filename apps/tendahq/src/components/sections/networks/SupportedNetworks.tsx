import { SectionShell } from '@/components/ui/SectionShell'
import { Eyebrow } from '@/components/ui/Eyebrow'
import { Pill } from '@/components/ui/Pill'
import { LANDING_CHAINS, MORE_CHAINS_LABEL } from '@/content'
import { NetworkCard } from './NetworkCard'
import { NETWORKS_FOOTNOTE, NETWORKS_HEADER } from './content'

/**
 * §07 Supported networks — one card per MAINNET chain in the shared manifest,
 * rendered as reference data.
 *
 * The grid maps LANDING_CHAINS rather than listing cards, so a chain added to
 * the manifest appears here with no edit to this file. The column count is
 * fixed at three because that is what the current chain count needs; it is
 * `md:grid-cols-2 lg:grid-cols-3`, which wraps rather than squashing when a
 * fourth arrives.
 */
export function SupportedNetworks() {
  return (
    <SectionShell id="networks" surface="base" padY="lg">
      <div className="mb-10 flex max-w-[62ch] flex-col gap-4">
        <Eyebrow tone="brand" dot>
          {NETWORKS_HEADER.eyebrow}
        </Eyebrow>
        <h2 className="h1 text-[var(--content-primary)]">
          {NETWORKS_HEADER.h2.lead}{' '}
          <span className="text-[var(--brand)]">{NETWORKS_HEADER.h2.emphasis}</span>
        </h2>
        <p className="body-lg text-[var(--content-secondary)]">{NETWORKS_HEADER.sub}</p>
      </div>

      <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
        {LANDING_CHAINS.map((chain) => (
          <NetworkCard key={chain.id} chain={chain} />
        ))}
      </div>

      <div className="mt-8 flex flex-wrap items-center gap-3">
        <Pill tone="neutral" size="sm">
          {MORE_CHAINS_LABEL}
        </Pill>
        <p className="body-sm text-[var(--content-tertiary)]">{NETWORKS_FOOTNOTE}</p>
      </div>
    </SectionShell>
  )
}
