/**
 * `resolveSignersForChain` — which of the reader's linked wallets may sign on a
 * given chain. Split out of dispatch.test.ts to keep both files inside the
 * 300-line limit; it is a pure selector over the auth store, so it needs only
 * the mocks that let @/wallet/dispatch load, not the transports themselves.
 */
import type { LinkedWallet } from '@tenda/shared'

// Created INSIDE each factory: jest hoists jest.mock above module-scope consts,
// so an outer reference would still be undefined when the factory first runs.
jest.mock('@solana/web3.js', () => ({
  VersionedTransaction: { deserialize: jest.fn() },
}))
jest.mock('@/wallet/adapters/solana-mwa', () => ({ signAndSendStored: jest.fn() }))
jest.mock('@/wallet/adapters/walletconnect', () => ({ sendEvmTransaction: jest.fn() }))
jest.mock('@/stores/auth.store', () => ({ useAuthStore: { getState: jest.fn() } }))
jest.mock('@/stores/escrow.store', () => ({ useEscrowStore: { getState: jest.fn() } }))
// Partial: the real module, because the namespace lookup this selector depends
// on reads the actual CHAIN_MANIFEST.
jest.mock('@tenda/shared', () => ({
  ...jest.requireActual('@tenda/shared'),
  ensureAllowance: jest.fn(),
}))
jest.mock('@/wallet/ensure-session', () => ({ ensureEvmSession: jest.fn() }))

import { resolveSignersForChain } from '@/wallet/dispatch'
import { useAuthStore } from '@/stores/auth.store'

describe('resolveSignersForChain', () => {
  const verified = (over: Partial<LinkedWallet> = {}): LinkedWallet => ({
    chain_ns: 'solana',
    address: 'SoLAddr1',
    is_primary: true,
    verified_at: '2026-08-01T00:00:00.000Z',
    ...over,
  })

  it('answers [] for a chain the manifest does not know — never a guess', () => {
    // The namespace comes from the manifest, NOT from splitting the id on ':'.
    // A split would turn 'eip155:99999' into a plausible-looking namespace and
    // hand the wallet an address for a chain this build cannot sign on.
    //
    // The reader MUST hold an eip155 wallet for this to prove anything: with
    // only a solana wallet the naive split returns [] as well, and the
    // assertion passes while testing nothing. (Caught by mutation, #30.)
    ;(useAuthStore.getState as jest.Mock).mockReturnValue({
      wallets: [verified(), verified({ chain_ns: 'eip155', address: '0xEvm1', is_primary: false })],
    })
    expect(resolveSignersForChain('eip155:99999')).toEqual([])
    expect(resolveSignersForChain('not-a-caip-id')).toEqual([])
  })

  it('offers the verified wallets for the chain’s OWN namespace, and no others', () => {
    ;(useAuthStore.getState as jest.Mock).mockReturnValue({
      wallets: [verified(), verified({ chain_ns: 'eip155', address: '0xEvm1', is_primary: false })],
    })
    const signers = resolveSignersForChain('solana:devnet')
    expect(signers).toContain('SoLAddr1')
    expect(signers).not.toContain('0xEvm1')
  })

  it('offers nothing when the reader has no wallet in that namespace', () => {
    ;(useAuthStore.getState as jest.Mock).mockReturnValue({
      wallets: [verified({ chain_ns: 'eip155', address: '0xEvm1' })],
    })
    expect(resolveSignersForChain('solana:devnet')).toEqual([])
  })
})
