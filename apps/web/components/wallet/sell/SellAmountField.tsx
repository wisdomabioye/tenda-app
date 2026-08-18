'use client'

/**
 * The amount input and the asset it is denominated in (Tier-3 comp, lines
 * 726-736).
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

export function SellAmountField({
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
      <MoneyField
        id="sell-amount"
        label={SELL_COPY.amountLabel}
        value={amount}
        onChange={onAmountChange}
        suffix={symbol}
      />

      {selection.options.length > 1 && (
        <div className="mt-3 flex flex-wrap gap-1.5" role="group" aria-label="Asset to sell">
          {selection.options.map((option: ExchangeAssetOption) => (
            <Chip
              key={assetOptionKey(option)}
              label={`${option.symbol} · ${chainLabel(option.chainId)}`}
              selected={assetOptionKey(option) === selection.selectedKey}
              onClick={() => selection.select(option)}
            />
          ))}
        </div>
      )}
    </div>
  )
}
