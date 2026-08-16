/**
 * The escrow dossier — the detail pane's centre (Tier 2 comp, lines 497-713).
 *
 * Composition only: the money block, the state timeline and the party-scoped
 * half each own their own rules, and this file just orders them. The public
 * half renders for everyone; the private half renders itself away when the
 * server's scoping has withheld it.
 */
import type { ReactNode } from 'react'
import type { EscrowTimelineInput } from '@tenda/shared'
import { StateTimeline } from '@/components/escrow/timeline'
import { MoneyBlock, type DossierFact } from './MoneyBlock'
import { PartyScopedSection, type PartyScopedProps } from './PartyScopedSection'

export interface EscrowDossierProps extends PartyScopedProps {
  title: string
  /** Base units, chain-attested NET. */
  amountRaw: string
  asset: string
  escrow: EscrowTimelineInput
  facts?: readonly DossierFact[]
  /** Rendered above the money block — takedown notices, CTAs. */
  banner?: ReactNode
  formatStamp?: (iso: string) => string
}

export function EscrowDossier({
  title,
  amountRaw,
  asset,
  escrow,
  facts,
  banner,
  formatStamp,
  ...partyScoped
}: EscrowDossierProps) {
  return (
    <article className="max-w-[840px] px-9 pb-16 pt-7">
      {banner}
      <h1 className="font-display text-[28px] font-bold leading-9 tracking-[-0.6px] text-content-primary">
        {title}
      </h1>

      <MoneyBlock amountRaw={amountRaw} asset={asset} facts={facts} />
      <StateTimeline escrow={escrow} formatStamp={formatStamp} />
      <PartyScopedSection {...partyScoped} />
    </article>
  )
}
