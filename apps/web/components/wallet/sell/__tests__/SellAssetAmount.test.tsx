/**
 * The "You sell" block — mobile's field order is the contract: the reader
 * picks WHAT they are selling before saying how much of it. The order test
 * reads the DOM relationship, not the code, so swapping the blocks back
 * (the pre-#50 layout: amount first, chips below) fails it.
 */
import { expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { SellAssetAmount } from '@/components/wallet/sell/SellAssetAmount'
import { SELL_COPY } from '@/components/wallet/sell/copy'
import type { ExchangeAssetOption } from '@/hooks/exchange/useExchangeAssetOptions'
import type { AssetSelection } from '@/hooks/wallet/useAssetSelection'

// Complete, uncast: a fixture is a claim about what the producer can send,
// and `useExchangeAssetOptions` never emits an option without a chainName.
const usdcSol: ExchangeAssetOption = {
  chainId: 'solana:devnet',
  assetId: 'USDC_SOL',
  symbol: 'USDC',
  decimals: 6,
  chainName: 'Solana Devnet',
  walletAddress: 'SoLAddr1',
}
const usdcBase: ExchangeAssetOption = {
  ...usdcSol,
  chainId: 'eip155:84532',
  assetId: 'USDC_BASE',
  chainName: 'Base Sepolia',
}

function selectionOf(options: ExchangeAssetOption[]): AssetSelection {
  return {
    options,
    option: options[0] ?? null,
    selectedKey: `${options[0]?.chainId}:${options[0]?.assetId}:${options[0]?.walletAddress}`,
    select: vi.fn(),
  }
}

it('renders the asset picker BEFORE the amount input (mobile order)', () => {
  render(
    <SellAssetAmount
      selection={selectionOf([usdcSol, usdcBase])}
      amount=""
      onAmountChange={vi.fn()}
    />,
  )
  const picker = screen.getByRole('group', { name: SELL_COPY.assetLabel })
  const amount = screen.getByLabelText(SELL_COPY.amountLabel)
  expect(
    picker.compareDocumentPosition(amount) & Node.DOCUMENT_POSITION_FOLLOWING,
  ).toBeTruthy()
})

it('shows the picker even with ONE option — the chip states what is being sold', () => {
  render(<SellAssetAmount selection={selectionOf([usdcSol])} amount="" onAmountChange={vi.fn()} />)
  expect(screen.getByRole('group', { name: SELL_COPY.assetLabel })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: /USDC/ })).toHaveAttribute('aria-pressed', 'true')
})

it('clicking a chip selects that option', () => {
  const selection = selectionOf([usdcSol, usdcBase])
  render(<SellAssetAmount selection={selection} amount="" onAmountChange={vi.fn()} />)
  fireEvent.click(screen.getByRole('button', { name: /Base/ }))
  expect(selection.select).toHaveBeenCalledWith(usdcBase)
})

it('with NO options (wallet unlinked mid-session) only the amount field remains', () => {
  render(<SellAssetAmount selection={selectionOf([])} amount="" onAmountChange={vi.fn()} />)
  expect(screen.queryByRole('group', { name: SELL_COPY.assetLabel })).toBeNull()
  expect(screen.getByLabelText(SELL_COPY.amountLabel)).toBeInTheDocument()
})

it('typing forwards through onAmountChange — the field is controlled, not local', () => {
  const onAmountChange = vi.fn()
  render(
    <SellAssetAmount selection={selectionOf([usdcSol])} amount="" onAmountChange={onAmountChange} />,
  )
  fireEvent.change(screen.getByLabelText(SELL_COPY.amountLabel), { target: { value: '25' } })
  expect(onAmountChange).toHaveBeenCalledWith('25')
})
