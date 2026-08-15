/**
 * Per-(wallet, chain) breakdown under the hero: chain name, truncated
 * address, USDC + native amounts (web port of mobile's WalletBalanceRows).
 */
import {
  amountRawToDisplay,
  truncateWallet,
  type WalletChainBalance,
} from '@tenda/shared'

function amountOf(balance: WalletChainBalance['usdc']): string | null {
  if (balance === null) return null
  const amount = amountRawToDisplay(balance.amountRaw, balance.assetId)
  return `${amount.toLocaleString('en-US', { maximumFractionDigits: balance.decimals })} ${balance.symbol}`
}

export function WalletBalanceRows({ balances }: { balances: WalletChainBalance[] }) {
  if (balances.length === 0) return null
  return (
    <ul className="flex flex-col gap-2">
      {balances.map((b) => {
        const usdc = amountOf(b.usdc)
        const native = amountOf(b.native)
        return (
          <li
            key={`${b.chainId}:${b.address}`}
            className="flex flex-wrap items-center gap-3 rounded-card border border-border-subtle bg-surface-card px-4 py-3"
          >
            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className="text-sm font-semibold text-content-primary">{b.displayName}</span>
              <span className="font-numeric text-xs text-content-tertiary">{truncateWallet(b.address)}</span>
            </div>
            <div className="flex flex-col items-end gap-0.5">
              <span className="font-numeric text-sm text-content-primary">{usdc ?? '—'}</span>
              {native !== null && (
                <span className="font-numeric text-xs text-content-tertiary">{native}</span>
              )}
            </div>
          </li>
        )
      })}
    </ul>
  )
}
