/**
 * pickWalletAddress / isLinkedWallet — wallets[] is the single source of trust.
 * Covers: corroborated session preferred, stale/unlinked session ignored,
 * primary-first fallback, unverified excluded, EVM case-insensitivity, and the
 * no-wallet null case.
 */
import type { LinkedWallet } from '@tenda/shared'
import { pickWalletAddress, isLinkedWallet } from '../wallet-address'

function w(over: Partial<LinkedWallet>): LinkedWallet {
  return {
    chain_ns: 'eip155',
    address: '0xLinked',
    is_primary: false,
    verified_at: '2026-01-01T00:00:00Z',
    ...over,
  }
}

describe('pickWalletAddress', () => {
  test('returns null when there is no verified wallet on the namespace', () => {
    expect(pickWalletAddress('eip155', null, [])).toBeNull()
    expect(pickWalletAddress('eip155', '0xLive', [])).toBeNull()
  })

  test('resolves a verified linked wallet with no session (the bug: eligibility from wallets[])', () => {
    const wallets = [w({ address: '0xLinked', is_primary: true })]
    expect(pickWalletAddress('eip155', null, wallets)).toBe('0xLinked')
  })

  test('prefers the session address when it is a verified linked wallet', () => {
    const wallets = [w({ address: '0xLive' }), w({ address: '0xOther', is_primary: true })]
    expect(pickWalletAddress('eip155', '0xLive', wallets)).toBe('0xLive')
  })

  test('ignores a stale/unlinked session address and falls back to the primary', () => {
    const wallets = [w({ address: '0xPrimary', is_primary: true }), w({ address: '0xSecondary' })]
    expect(pickWalletAddress('eip155', '0xStale', wallets)).toBe('0xPrimary')
  })

  test('falls back to the first verified wallet when none is primary', () => {
    const wallets = [w({ address: '0xFirst' }), w({ address: '0xSecond' })]
    expect(pickWalletAddress('eip155', null, wallets)).toBe('0xFirst')
  })

  test('excludes unverified wallets from both the session check and the fallback', () => {
    const wallets = [w({ address: '0xUnverified', verified_at: null })]
    expect(pickWalletAddress('eip155', '0xUnverified', wallets)).toBeNull()
  })

  test('matches EVM addresses case-insensitively (checksum-agnostic)', () => {
    const wallets = [w({ address: '0xABCDEF', is_primary: true })]
    expect(pickWalletAddress('eip155', '0xabcdef', wallets)).toBe('0xabcdef')
  })

  test('is namespace-scoped: an EVM wallet does not satisfy a solana lookup', () => {
    const wallets = [w({ address: '0xLinked', is_primary: true })]
    expect(pickWalletAddress('solana', null, wallets)).toBeNull()
  })

  test('solana addresses are matched case-sensitively', () => {
    const wallets = [w({ chain_ns: 'solana', address: 'SoLAddr', is_primary: true })]
    expect(pickWalletAddress('solana', 'soladdr', wallets)).toBe('SoLAddr') // falls back, no case-fold
    expect(pickWalletAddress('solana', 'SoLAddr', wallets)).toBe('SoLAddr')
  })
})

describe('isLinkedWallet', () => {
  test('true only for a verified wallet on the namespace', () => {
    const wallets = [w({ address: '0xLinked' }), w({ chain_ns: 'solana', address: 'SoL' })]
    expect(isLinkedWallet('eip155', '0xLINKED', wallets)).toBe(true)
    expect(isLinkedWallet('eip155', '0xNope', wallets)).toBe(false)
    expect(isLinkedWallet('solana', 'SoL', wallets)).toBe(true)
  })
})
