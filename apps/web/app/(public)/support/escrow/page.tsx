/**
 * Payments & Escrow guide — public SSR. The fee calculator is the one
 * interactive island (client component below the static content).
 */
import type { Metadata } from 'next'
import { SUPPORT_ESCROW_FLOW, SUPPORT_ESCROW_INTRO, APP_INFO } from '@tenda/shared'
import { SupportShell, InfoCard } from '@/components/public/SupportArticle'
import { EscrowFeeCalculator } from './FeeCalculator'

export const metadata: Metadata = {
  title: `Payments & Escrow · ${APP_INFO.name}`,
  description: 'How Tenda holds funds on-chain and pays workers.',
}

export default function EscrowGuidePage() {
  return (
    <SupportShell title="Payments & Escrow">
      <InfoCard label={SUPPORT_ESCROW_INTRO.label} body={SUPPORT_ESCROW_INTRO.body} />
      <InfoCard label="How the money moves">
        <ol className="flex flex-col gap-3">
          {SUPPORT_ESCROW_FLOW.map((step) => (
            <li key={step.num} className="flex gap-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-primary-surface font-numeric text-xs font-bold text-brand-primary">
                {step.num}
              </span>
              <div>
                <p className="text-sm font-semibold text-content-primary">{step.title}</p>
                <p className="text-sm text-content-secondary">{step.desc}</p>
              </div>
            </li>
          ))}
        </ol>
      </InfoCard>
      <EscrowFeeCalculator />
    </SupportShell>
  )
}
