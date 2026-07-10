/**
 * AssetChainPicker — one chip per sellable (asset, chain) pair. Hidden when
 * there's a single option (no choice), fires onSelect with the chosen option.
 */
import { render, fireEvent, screen } from '@testing-library/react-native'

jest.mock('@/components/ui/Chip', () => {
  const { Pressable, Text } = require('react-native')
  return {
    Chip: ({ label, onPress, selected }: { label: string; onPress?: () => void; selected?: boolean }) => (
      <Pressable accessibilityRole="button" accessibilityState={{ selected: !!selected }} onPress={onPress}>
        <Text>{label}</Text>
      </Pressable>
    ),
  }
})
jest.mock('@/components/ui/SectionLabel', () => {
  const { Text } = require('react-native')
  return { SectionLabel: ({ children }: { children: React.ReactNode }) => <Text>{children}</Text> }
})

import { AssetChainPicker, optionKey } from '../AssetChainPicker'
import type { ExchangeAssetOption } from '@/hooks/useExchangeAssetOptions'

const USDC_SOL: ExchangeAssetOption = { chainId: 'solana:devnet', assetId: 'USDC_SOL', symbol: 'USDC', decimals: 6, chainName: 'Solana Devnet', walletAddress: 'sol1' }
const SOL: ExchangeAssetOption = { chainId: 'solana:devnet', assetId: 'SOL_DEVNET', symbol: 'SOL', decimals: 9, chainName: 'Solana Devnet', walletAddress: 'sol1' }
const USDC_BASE: ExchangeAssetOption = { chainId: 'eip155:84532', assetId: 'USDC_BASE', symbol: 'USDC', decimals: 6, chainName: 'Base Sepolia', walletAddress: '0xabc' }

test('optionKey is unique per chain+asset', () => {
  expect(optionKey(USDC_SOL)).toBe('solana:devnet:USDC_SOL')
  expect(optionKey(USDC_SOL)).not.toBe(optionKey(USDC_BASE))
})

test('renders a chip per option and marks the selected one', () => {
  render(<AssetChainPicker options={[USDC_SOL, SOL, USDC_BASE]} selectedKey={optionKey(SOL)} onSelect={jest.fn()} />)
  expect(screen.getByText('USDC · Solana Devnet')).toBeTruthy()
  expect(screen.getByText('SOL · Solana Devnet')).toBeTruthy()
  expect(screen.getByText('USDC · Base Sepolia')).toBeTruthy()
})

test('selecting a chip fires onSelect with the full option', () => {
  const onSelect = jest.fn()
  render(<AssetChainPicker options={[USDC_SOL, USDC_BASE]} selectedKey={optionKey(USDC_SOL)} onSelect={onSelect} />)
  fireEvent.press(screen.getByText('USDC · Base Sepolia'))
  expect(onSelect).toHaveBeenCalledWith(USDC_BASE)
})

test('renders nothing when there is a single (or no) option', () => {
  const { toJSON: one } = render(<AssetChainPicker options={[USDC_SOL]} selectedKey={optionKey(USDC_SOL)} onSelect={jest.fn()} />)
  expect(one()).toBeNull()
})
