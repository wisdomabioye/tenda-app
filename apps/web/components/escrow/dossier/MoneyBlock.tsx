/**
 * The dossier's money block (Tier 2 comp, lines 500-517): one figure, one
 * projection.
 *
 * The figure is `amount_raw` rendered through shared `formatAssetAmount`,
 * which is BigInt-based — base units are 78-digit decimal STRINGS and
 * Number() would silently lose precision on anything large.
 *
 * It deliberately does NOT run useEscrowFee. That hook is the single source
 * for PROJECTING a fee before signing; on an escrow that already exists,
 * `amount_raw` is the chain-attested NET and the fee has already come off.
 * Re-deriving it here would show a second, disagreeing number for the same
 * money — the exact drift settlement-amount honesty exists to prevent.
 */
import { formatAssetAmount } from '@tenda/shared'
import type { ReactNode } from 'react'
import { DOSSIER_COPY } from './copy'

export interface DossierFact {
  label: string
  value: ReactNode
}

export function MoneyBlock({
  amountRaw,
  asset,
  facts = [],
}: {
  /** Base units, as a decimal string. Chain-attested NET. */
  amountRaw: string
  asset: string
  facts?: readonly DossierFact[]
}) {
  // The comp sets the amount and its symbol at different sizes, so they are
  // split apart rather than re-derived — one formatter, one source of truth.
  // formatAssetAmount always emits "<value> <symbol>", and the split takes the
  // LAST space so a value carrying thousands separators stays intact. That
  // contract is pinned by a test, not assumed.
  const formatted = formatAssetAmount(amountRaw, asset)
  const lastSpace = formatted.lastIndexOf(' ')
  const amount = formatted.slice(0, lastSpace)
  const symbol = formatted.slice(lastSpace + 1)

  return (
    <div className="mt-7 rounded-card border border-border-default bg-surface-card p-6 shadow-card">
      <p className="font-numeric text-xs font-medium uppercase leading-4 tracking-[0.13em] text-content-tertiary">
        {DOSSIER_COPY.amountLabel}
      </p>
      <div className="mt-2 flex items-end gap-2">
        <span className="font-numeric text-[40px] font-bold leading-[44px] tracking-[-1px] text-utility-money">
          {amount}
        </span>
        <span className="pb-1 font-numeric text-[15px] leading-[22px] text-content-tertiary">
          {symbol}
        </span>
      </div>
      <p className="mt-2 max-w-[52ch] text-[13px] leading-[18px] text-content-secondary">
        {DOSSIER_COPY.amountNote}
      </p>

      {facts.length > 0 && (
        <dl className="mt-5 grid grid-cols-[repeat(auto-fit,minmax(150px,1fr))] gap-x-6 gap-y-4 border-t border-border-subtle pt-5">
          {facts.map((fact) => (
            <div key={fact.label}>
              <dt className="mb-0.5 text-xs leading-4 text-content-tertiary">{fact.label}</dt>
              <dd className="text-[15px] leading-[22px] text-content-primary">{fact.value}</dd>
            </div>
          ))}
        </dl>
      )}
    </div>
  )
}
