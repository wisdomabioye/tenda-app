'use client'

/**
 * Budget input for the composer's payment step — web port of mobile's
 * PaymentInput, ASSET-units mode only.
 *
 * DIVERGENCE from mobile, deliberate and temporary: mobile offers a FIAT
 * entry mode converted through the exchange-rate + settings stores, neither
 * of which exists on web yet (they land with the Exchange surface, S6.4).
 * The money math is unchanged — display units → raw via the asset's
 * decimals, clamped to the shared gig bounds.
 */
import { useState } from 'react'
import { ASSET_META, gigAmountBounds } from '@tenda/shared'

export function PaymentInput({
  asset,
  value,
  onChange,
}: {
  /** Asset registry id (CO5), drives decimals, symbol and budget rails. */
  asset: string
  /** Raw units of `asset`. */
  value: number
  onChange: (raw: number) => void
}) {
  const meta = ASSET_META[asset]
  const symbol = meta?.symbol ?? asset
  const decimals = meta?.decimals ?? 9
  const scale = 10 ** decimals

  const hasInitial = value > 0
  const [text, setText] = useState(() => (hasInitial ? String(value / scale) : ''))

  const { min_raw, max_raw } = gigAmountBounds(asset)
  const minDisplay = `${min_raw / scale} ${symbol}`

  function handleChange(raw: string) {
    setText(raw)
    const num = parseFloat(raw)
    if (isNaN(num) || num <= 0) {
      onChange(0)
      return
    }
    onChange(Math.min(Math.round(num * scale), max_raw))
  }

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-baseline gap-2 rounded-card bg-surface-inset px-4 py-3">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-content-tertiary">
          Budget
        </span>
        <input
          inputMode="decimal"
          value={text}
          placeholder="0.00"
          aria-label={`Budget in ${symbol}`}
          onChange={(e) => handleChange(e.target.value)}
          className="w-full bg-transparent font-mono text-xl font-bold text-content-primary outline-none placeholder:text-content-tertiary"
        />
        <span className="font-mono text-sm text-content-tertiary">{symbol}</span>
      </div>
      <p className="text-xs text-content-tertiary">Minimum {minDisplay}</p>
    </div>
  )
}
