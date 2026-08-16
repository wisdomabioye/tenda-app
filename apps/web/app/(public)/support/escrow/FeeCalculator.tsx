'use client'

/**
 * Fee calculator island — mirrors mobile's escrow-guide calculator: the
 * static platform-fee % from APP_INFO (STATIC COPY; live surfaces read
 * the platform config endpoint instead).
 */
import { useState } from 'react'
import { APP_INFO, SUPPORT_FEE_NOTE } from '@tenda/shared'
import { InfoCard } from '@/components/public/SupportArticle'

export function EscrowFeeCalculator() {
  const [amount, setAmount] = useState('')
  const numeric = parseFloat(amount.replace(/,/g, '')) || 0
  const fee = numeric * (APP_INFO.fees.platformFeePct / 100)
  const receives = numeric - fee

  return (
    <InfoCard label={`Fee calculator (${APP_INFO.fees.platformFeePct}% platform fee)`}>
      <label className="flex flex-col gap-1 text-sm">
        <span className="text-content-secondary">Gig amount</span>
        <input
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          inputMode="decimal"
          placeholder="0.00"
          className="rounded-control border border-border-default bg-surface-background p-2.5 font-numeric text-content-primary outline-none focus:border-brand-primary"
        />
      </label>
      {numeric > 0 && (
        <dl className="flex flex-col gap-1 font-numeric text-sm">
          <div className="flex justify-between">
            <dt className="text-content-secondary">Platform fee</dt>
            <dd className="text-content-primary">{fee.toFixed(4)}</dd>
          </div>
          <div className="flex justify-between font-semibold">
            <dt className="text-content-secondary">Worker receives</dt>
            <dd className="text-content-primary">{receives.toFixed(4)}</dd>
          </div>
        </dl>
      )}
      <p className="text-xs text-content-tertiary">{SUPPORT_FEE_NOTE}</p>
    </InfoCard>
  )
}
