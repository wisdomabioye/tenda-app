/**
 * The balances grid (Tier-3 comp, lines 650-660): one card per chain the
 * reader holds on, the figure at deciding size with its ticker beside it.
 *
 * A chain with NO reading shows an em-dash and says so in its note. It does
 * not show `0.00`: "you have nothing here" and "we could not read this" are
 * different facts, and the second one dressed as the first is the wallet bug
 * this app already fixed once at the section level (`resolveWalletSection`).
 */
import { amountRawToDisplay, truncateWallet, type WalletChainBalance } from '@tenda/shared'
import { WALLET_COPY } from './copy'

interface Reading {
  value: string
  unit: string
}

function readingOf(balance: WalletChainBalance['usdc']): Reading | null {
  if (balance === null) return null
  const amount = amountRawToDisplay(balance.amountRaw, balance.assetId)
  return {
    value: amount.toLocaleString('en-US', { maximumFractionDigits: balance.decimals }),
    unit: balance.symbol,
  }
}

export function WalletBalanceGrid({ balances }: { balances: WalletChainBalance[] }) {
  if (balances.length === 0) return null

  return (
    <div
      data-bal
      className="grid grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-3.5"
    >
      {balances.map((balance) => {
        const usdc = readingOf(balance.usdc)
        const native = readingOf(balance.native)
        return (
          <div
            key={`${balance.chainId}:${balance.address}`}
            className="rounded-card border border-border-subtle bg-surface-card p-5 shadow-card"
          >
            <p className="truncate text-[13px] font-semibold leading-[18px] text-content-secondary">
              {balance.displayName}
            </p>
            <p className="mt-2 flex items-baseline gap-1.5">
              <span className="font-numeric text-[28px] font-bold leading-8 tracking-[-0.6px] text-content-primary">
                {usdc?.value ?? '—'}
              </span>
              <span className="font-numeric text-[13px] leading-[18px] text-content-tertiary">
                {usdc?.unit ?? ''}
              </span>
            </p>
            <p className="mt-2 truncate font-numeric text-xs leading-4 text-content-tertiary">
              {truncateWallet(balance.address)}
              {native !== null ? ` · ${native.value} ${native.unit}` : ` · ${WALLET_COPY.noNative}`}
            </p>
          </div>
        )
      })}
    </div>
  )
}
