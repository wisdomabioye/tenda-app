/** Per-chain balance rows: amounts in display units, dash for no USDC. */
import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import type { WalletChainBalance } from '@tenda/shared'
import { WalletBalanceRows } from '@/components/wallet/WalletBalanceRows'

const ROW: WalletChainBalance = {
  chainId: 'solana:devnet',
  namespace: 'solana',
  displayName: 'Solana Devnet',
  address: 'SoLAddr11111111111111111111111111111111111',
  usdc: { assetId: 'USDC_SOL', symbol: 'USDC', amountRaw: '48500000', decimals: 6, isStable: true },
  native: { assetId: 'SOL_DEVNET', symbol: 'SOL', amountRaw: '1200000000', decimals: 9, isStable: false },
}

describe('WalletBalanceRows', () => {
  it('renders chain name, truncated address, USDC and native display amounts', () => {
    render(<WalletBalanceRows balances={[ROW]} />)
    expect(screen.getByText('Solana Devnet')).toBeInTheDocument()
    expect(screen.getByText('SoLA…1111')).toBeInTheDocument()
    expect(screen.getByText('48.5 USDC')).toBeInTheDocument()
    expect(screen.getByText('1.2 SOL')).toBeInTheDocument()
    expect(screen.queryByText(ROW.address)).toBeNull() // never the full address
  })

  it('shows a dash when the chain has no USDC balance, and nothing for no rows', () => {
    const { container, unmount } = render(
      <WalletBalanceRows balances={[{ ...ROW, usdc: null, native: null }]} />,
    )
    expect(screen.getByText('—')).toBeInTheDocument()
    expect(container.textContent).not.toContain('USDC')
    unmount()

    const empty = render(<WalletBalanceRows balances={[]} />)
    expect(empty.container.firstChild).toBeNull()
  })
})
