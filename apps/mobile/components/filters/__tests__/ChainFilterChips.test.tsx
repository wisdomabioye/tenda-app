/**
 * ChainFilterChips — options come from the live chain registry, never a
 * hardcoded list, and the control hides itself when there is nothing to
 * choose between.
 */
import { render, screen, fireEvent } from '@testing-library/react-native'
import type { ChainRegistryEntry } from '@tenda/shared'

const mockChains = jest.fn()
jest.mock('@/stores/chain-registry.store', () => ({
  useChainRegistryStore: (selector: (s: { chains: ChainRegistryEntry[] | null }) => unknown) =>
    selector({ chains: mockChains() }),
}))
jest.mock('@/components/ui', () => {
  const { Text, Pressable } = require('react-native')
  return {
    Chip: ({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) => (
      <Pressable onPress={onPress}>
        <Text>{`${label}${selected ? ' *' : ''}`}</Text>
      </Pressable>
    ),
  }
})

import { ChainFilterChips } from '../ChainFilterChips'

const chain = (id: string, display_name: string): ChainRegistryEntry => ({
  id,
  namespace: id.startsWith('solana') ? 'solana' : 'eip155',
  display_name,
  escrow_address: '0xdead',
  assets: [],
})

const TWO_CHAINS = [chain('solana:devnet', 'Solana Devnet'), chain('eip155:84532', 'Base Sepolia')]

beforeEach(() => mockChains.mockReset())

test('renders one chip per registered chain plus "All chains"', () => {
  mockChains.mockReturnValue(TWO_CHAINS)
  render(<ChainFilterChips value={null} onChange={jest.fn()} />)
  expect(screen.getByText('All chains *')).toBeTruthy()
  expect(screen.getByText('Solana Devnet')).toBeTruthy()
  expect(screen.getByText('Base Sepolia')).toBeTruthy()
})

test('emits the CAIP-2 id the server filter expects', () => {
  mockChains.mockReturnValue(TWO_CHAINS)
  const onChange = jest.fn()
  render(<ChainFilterChips value={null} onChange={onChange} />)
  fireEvent.press(screen.getByText('Base Sepolia'))
  expect(onChange).toHaveBeenCalledWith('eip155:84532')
})

test('re-tapping the active chain does NOT clear the filter', () => {
  // The row is single-select with an explicit "All chains" option, so a second
  // tap must be a no-op. Toggling to null here meant a user who tapped again
  // (thinking the first tap hadn't registered) landed silently on all chains.
  mockChains.mockReturnValue(TWO_CHAINS)
  const onChange = jest.fn()
  render(<ChainFilterChips value="eip155:84532" onChange={onChange} />)
  fireEvent.press(screen.getByText('Base Sepolia *'))
  expect(onChange).not.toHaveBeenCalledWith(null)
  expect(onChange).toHaveBeenCalledWith('eip155:84532')
})

test('"All chains" clears the filter', () => {
  mockChains.mockReturnValue(TWO_CHAINS)
  const onChange = jest.fn()
  render(<ChainFilterChips value="solana:devnet" onChange={onChange} />)
  fireEvent.press(screen.getByText('All chains'))
  expect(onChange).toHaveBeenCalledWith(null)
})

test('renders nothing before the registry has loaded', () => {
  mockChains.mockReturnValue(null)
  const { toJSON } = render(<ChainFilterChips value={null} onChange={jest.fn()} />)
  expect(toJSON()).toBeNull()
})

test('renders nothing on a single-chain deployment — a one-option filter is noise', () => {
  mockChains.mockReturnValue([chain('solana:devnet', 'Solana Devnet')])
  const { toJSON } = render(<ChainFilterChips value={null} onChange={jest.fn()} />)
  expect(toJSON()).toBeNull()
})

test('stays visible when the options collapse to one but a filter is ACTIVE', () => {
  // A chain disabled server-side while the user has it selected must not hide
  // the only control that can clear the filter.
  mockChains.mockReturnValue([chain('solana:devnet', 'Solana Devnet')])
  const onChange = jest.fn()
  render(<ChainFilterChips value="eip155:84532" onChange={onChange} />)
  fireEvent.press(screen.getByText('All chains'))
  expect(onChange).toHaveBeenCalledWith(null)
})
