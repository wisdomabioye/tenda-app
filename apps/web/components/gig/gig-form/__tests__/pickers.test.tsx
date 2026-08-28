/**
 * The chip-row pickers: NetworkPicker's collapse + link-a-wallet gating,
 * the deadline options, acceptance-mode radios, and proof normalisation
 * through the REAL shared helper.
 */
import { fireEvent, render, screen } from '@testing-library/react'
import { expect, test, vi } from 'vitest'
import { DATA_PROOF_TYPES, FILE_PROOF_TYPES, PROOF_TYPE_LABEL, type ProofType } from '@tenda/shared'
import { AcceptDeadlinePicker } from '@/components/gig/gig-form/AcceptDeadlinePicker'
import { AcceptanceModePicker } from '@/components/gig/gig-form/AcceptanceModePicker'
import { NetworkPicker } from '@/components/gig/gig-form/NetworkPicker'
import { ProofRequirementPicker } from '@/components/gig/gig-form/ProofRequirementPicker'

const OPTIONS = [
  { id: 'solana:devnet', label: 'Solana', enabled: true },
  { id: 'eip155:84532', label: 'Base Sepolia', enabled: false },
]

test('NetworkPicker renders nothing with a single eligible chain (no choice to make)', () => {
  const { container } = render(
    <NetworkPicker options={[OPTIONS[0]]} selected="solana:devnet" onSelect={vi.fn()} assetSymbol="USDC" />,
  )
  expect(container).toBeEmptyDOMElement()
})

test('an EVM chain without a linked wallet is visible but disabled with the link hint', () => {
  const onSelect = vi.fn()
  render(<NetworkPicker options={OPTIONS} selected="solana:devnet" onSelect={onSelect} assetSymbol="USDC" />)
  const disabled = screen.getByRole('button', { name: 'Base Sepolia (link a wallet)' })
  expect(disabled).toBeDisabled()
  fireEvent.click(disabled)
  expect(onSelect).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole('button', { name: 'Solana' }))
  expect(onSelect).toHaveBeenCalledWith('solana:devnet')
})

test('AcceptDeadlinePicker offers the shared options and reports hours', () => {
  const onChange = vi.fn()
  render(<AcceptDeadlinePicker value={168} onChange={onChange} />)
  expect(screen.getByRole('button', { name: '7d' })).toHaveAttribute('aria-pressed', 'true')
  fireEvent.click(screen.getByRole('button', { name: '48h' }))
  expect(onChange).toHaveBeenCalledWith(48)
})

test('AcceptanceModePicker states both consequences and reports the mode', () => {
  const onChange = vi.fn()
  render(<AcceptanceModePicker requiresApproval={false} onChange={onChange} />)
  expect(screen.getByRole('radio', { name: /First come/ })).toHaveAttribute('aria-checked', 'true')
  // The pricier option names its cost so it is not chosen by accident.
  const approval = screen.getByRole('radio', { name: /I approve the worker/ })
  expect(approval.textContent).toMatch(/extra transaction/)
  fireEvent.click(approval)
  expect(onChange).toHaveBeenCalledWith(true)
})

test('ProofRequirementPicker offers FILE types only — data types wait for the #15 params/capture UI', () => {
  // A data-type requirement made here would be refused by the server
  // (geotag/structured demand params this form cannot supply) or strand the
  // worker (the upload dialog attaches FILES, so a required `text` could
  // never be satisfied).
  render(<ProofRequirementPicker value={[]} onChange={vi.fn()} />)
  for (const type of FILE_PROOF_TYPES) {
    expect(screen.getByRole('button', { name: PROOF_TYPE_LABEL[type] })).toBeInTheDocument()
  }
  for (const type of DATA_PROOF_TYPES) {
    expect(screen.queryByRole('button', { name: PROOF_TYPE_LABEL[type] })).toBeNull()
  }
})

test('ProofRequirementPicker toggles through the REAL normaliser (order is canonical)', () => {
  const onChange = vi.fn()
  const { rerender } = render(<ProofRequirementPicker value={[]} onChange={vi.fn()} />)
  rerender(<ProofRequirementPicker value={['video'] as ProofType[]} onChange={onChange} />)
  fireEvent.click(screen.getByRole('button', { name: 'Photo' }))
  // video-then-photo normalises to the server's order, not click order.
  expect(onChange).toHaveBeenCalledWith(['image', 'video'])
  fireEvent.click(screen.getByRole('button', { name: 'Video' }))
  expect(onChange).toHaveBeenLastCalledWith([])
})
