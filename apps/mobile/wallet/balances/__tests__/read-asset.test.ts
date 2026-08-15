/**
 * readAssetBalance — the targeted single-asset read behind the sufficiency
 * pre-flight. Verifies it routes to the namespace's reader in shared's
 * DEFAULT_READERS (the converged registry), passes the assetIds filter (the
 * "one RPC" property), and returns null — meaning UNKNOWN, never zero — when
 * the asset is absent or the read comes back empty.
 */
import type { ChainRegistryEntry } from '@tenda/shared'

const mockSolRead = jest.fn()
const mockEvmRead = jest.fn()
jest.mock('@tenda/shared', () => ({
  ...jest.requireActual('@tenda/shared'),
  DEFAULT_READERS: {
    solana: { read: (...a: unknown[]) => mockSolRead(...a) },
    eip155: { read: (...a: unknown[]) => mockEvmRead(...a) },
  },
}))

import { readAssetBalance } from '@/wallet/balances/read-asset'

const evmChain: ChainRegistryEntry = {
  id: 'eip155:84532',
  namespace: 'eip155',
  display_name: 'Base Sepolia',
  escrow_address: '0xEscrow',
  assets: [
    { id: 'USDC_BASE', symbol: 'USDC', decimals: 6, is_stable: true, token_address: '0xT', supports_permit: true },
  ],
}
const solChain: ChainRegistryEntry = {
  id: 'solana:devnet',
  namespace: 'solana',
  display_name: 'Solana Devnet',
  escrow_address: 'PROGRAM',
  assets: [
    { id: 'USDC_SOL', symbol: 'USDC', decimals: 6, is_stable: true, token_address: 'MINT', supports_permit: false },
  ],
}

const USDC = { assetId: 'USDC_BASE', symbol: 'USDC', amountRaw: '48500000', decimals: 6, isStable: true }

beforeEach(() => {
  mockSolRead.mockReset()
  mockEvmRead.mockReset()
})

test('routes to the namespace reader with the single-asset filter (one RPC, not one per asset)', async () => {
  mockEvmRead.mockResolvedValue([USDC])
  const out = await readAssetBalance('0xabc', evmChain, 'USDC_BASE')
  expect(out).toEqual(USDC)
  expect(mockEvmRead).toHaveBeenCalledWith('0xabc', evmChain, ['USDC_BASE'])
  expect(mockSolRead).not.toHaveBeenCalled()
})

test('a Solana chain routes to the Solana reader', async () => {
  mockSolRead.mockResolvedValue([{ ...USDC, assetId: 'USDC_SOL' }])
  const out = await readAssetBalance('SoL', solChain, 'USDC_SOL')
  expect(out?.assetId).toBe('USDC_SOL')
  expect(mockEvmRead).not.toHaveBeenCalled()
})

test('an empty read answers null — UNKNOWN, never zero', async () => {
  mockEvmRead.mockResolvedValue([])
  await expect(readAssetBalance('0xabc', evmChain, 'USDC_BASE')).resolves.toBeNull()
})

test('a read that returns OTHER assets still answers null for the one asked for', async () => {
  mockEvmRead.mockResolvedValue([{ ...USDC, assetId: 'SOMETHING_ELSE' }])
  await expect(readAssetBalance('0xabc', evmChain, 'USDC_BASE')).resolves.toBeNull()
})
