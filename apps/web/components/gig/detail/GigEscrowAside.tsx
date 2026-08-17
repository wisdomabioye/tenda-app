/**
 * The sticky right column (comp lines 657-681): the money, the way in, and
 * the two sentences that explain why either can be trusted.
 *
 * The figure is `amount_raw` split by shared `splitAssetAmount` — the
 * chain-attested NET. It deliberately does NOT project a fee: on an escrow
 * that already exists the fee has come off, and re-deriving it here would put
 * a second, disagreeing number for the same money on the page.
 *
 * The action slot holds `GigDetailApp`, which renders the sign-in CTA for an
 * anonymous reader and swaps in the party-scoped surface once a bearer
 * refetch lands. Only the explicit public allowlist crosses into it — client
 * component props are SERIALISED into the anonymous HTML.
 */
import { ShieldCheck } from 'lucide-react'
import { chainLabel, splitAssetAmount, type GigDetail } from '@tenda/shared'
import { Eyebrow } from '@/components/ui'
import { GigDetailApp } from './GigDetailApp'
import { GigSettlementSteps } from './GigSettlementSteps'
import { GIG_DETAIL_COPY } from './copy'

export function GigEscrowAside({ gig }: { gig: GigDetail }) {
  const { amount, symbol } = splitAssetAmount(gig.amount_raw, gig.asset)

  return (
    <aside className="flex flex-col gap-4 lg:sticky lg:top-24">
      <div className="rounded-card border border-border-default bg-surface-card p-6 shadow-card">
        <Eyebrow>{GIG_DETAIL_COPY.locked}</Eyebrow>
        <div className="mt-2.5 flex items-end gap-2">
          <span className="font-numeric text-[40px] font-bold leading-[44px] tracking-[-1px] text-utility-money">
            {amount}
          </span>
          {/* See GigCard: the space is for textContent, not for layout. */}
          {' '}
          <span className="pb-1 font-numeric text-[15px] leading-[22px] text-content-tertiary">
            {symbol}
          </span>
        </div>
        <p className="mt-2.5 text-[13px] leading-[18px] text-content-secondary">
          {GIG_DETAIL_COPY.lockedNote}
        </p>

        <div className="my-5 h-px bg-border-subtle" />

        <GigDetailApp
          initial={{
            escrow_id: gig.escrow_id,
            status: gig.status,
            is_assigned: gig.is_assigned,
            requires_approval: gig.requires_approval,
          }}
        />

        <div className="mt-5 flex items-start gap-2.5 border-t border-border-subtle pt-5">
          <ShieldCheck
            size={16}
            aria-hidden
            className="mt-0.5 shrink-0 text-feedback-success-base"
          />
          <p className="text-[13px] leading-[18px] text-content-secondary">
            {GIG_DETAIL_COPY.lockedOn(chainLabel(gig.chain_id))}
          </p>
        </div>
      </div>

      <GigSettlementSteps requiresApproval={gig.requires_approval} />
    </aside>
  )
}
