'use client'

/**
 * The "You sell" block shared by both sell tabs (web port of mobile's
 * SellAssetAmount): asset/chain picker first, then the amount — the reader
 * picks WHAT they are selling before saying how much of it.
 *
 * The comp's second chip row is fiat currencies to buy with. Ours is the
 * asset/chain being SOLD, because that is the choice this surface actually
 * has: the payout currency is derived from the payout account's country
 * (`payoutCurrencyForCountry`), not picked here — offering it would let a
 * reader choose a currency their account cannot receive.
 */
import { Chip } from '@/components/ui/Chip'
import { MoneyField } from './MoneyField'
import { chainLabel } from '@tenda/shared'
import type { ExchangeAssetOption } from '@/hooks/exchange/useExchangeAssetOptions'
import { assetOptionKey, type AssetSelection } from '@/hooks/wallet/useAssetSelection'
import { SELL_COPY } from './copy'

export function SellAssetAmount({
  selection,
  amount,
  onAmountChange,
}: {
  selection: AssetSelection
  amount: string
  onAmountChange: (next: string) => void
}) {
  const symbol = selection.option?.symbol ?? ''

  return (
    <div>
      {/* Rendered even with ONE option (mobile's picker does the same): the
          chip is what states the "you sell X on Y" fact before the number. */}
      {selection.options.length > 0 && (
        <div>
          <p className="text-[13px] font-semibold leading-[18px] text-content-secondary">
            {SELL_COPY.assetLabel}
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5" role="group" aria-label={SELL_COPY.assetLabel}>
            {selection.options.map((option: ExchangeAssetOption) => (
              <Chip
                key={assetOptionKey(option)}
                label={`${option.symbol} · ${chainLabel(option.chainId)}`}
                selected={assetOptionKey(option) === selection.selectedKey}
                onClick={() => selection.select(option)}
              />
            ))}
          </div>
        </div>
      )}

      <div className="mt-4">
        <MoneyField
          id="sell-amount"
          label={SELL_COPY.amountLabel}
          value={amount}
          onChange={onAmountChange}
          suffix={symbol}
        />
      </div>
    </div>
  )
}
