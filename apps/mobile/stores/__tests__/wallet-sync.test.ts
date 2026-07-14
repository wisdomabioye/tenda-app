import type { LinkedWallet, MeResponse, MeUser } from '@tenda/shared'

// ApiClientError is defined inside the factory (jest hoists mocks above imports);
// isRetriableMeError's `instanceof` matches because both resolve to this class.
jest.mock('@/api/client', () => {
  class ApiClientError extends Error {
    statusCode: number
    code?: string
    constructor(statusCode: number, _error = '', message = '', code?: string) {
      super(message)
      this.statusCode = statusCode
      this.code = code
    }
  }
  return { ApiClientError, api: {} }
})

import { reconcileWalletState, isRetriableMeError } from '@/stores/wallet-sync'
import { ApiClientError } from '@/api/client'

const EVM = '0xAbC0000000000000000000000000000000000001'
const SOL = 'So1anaAddr11111111111111111111111111111111'

function wallet(chain_ns: 'eip155' | 'solana', address: string, verified = true): LinkedWallet {
  return { chain_ns, address, is_primary: true, verified_at: verified ? '2026-01-01T00:00:00Z' : null }
}

function me(wallets: LinkedWallet[]): MeResponse {
  return { user: {} as MeUser, wallets, profile_complete: true }
}

describe('reconcileWalletState', () => {
  test('adopts the fresh wallets[] and profile flag', () => {
    const out = reconcileWalletState({ walletAddress: null, evmAddress: null }, me([wallet('eip155', EVM)]))
    expect(out.wallets).toHaveLength(1)
    expect(out.profileComplete).toBe(true)
  })

  test('keeps a session address slot when it is still a verified linked wallet', () => {
    const out = reconcileWalletState(
      { walletAddress: SOL, evmAddress: EVM },
      me([wallet('eip155', EVM), wallet('solana', SOL)]),
    )
    expect(out.evmAddress).toBe(EVM)
    expect(out.walletAddress).toBe(SOL)
  })

  test('drops a session address that is no longer a linked wallet', () => {
    const out = reconcileWalletState({ walletAddress: SOL, evmAddress: EVM }, me([]))
    expect(out.evmAddress).toBeNull()
    expect(out.walletAddress).toBeNull()
  })

  test('drops a session address whose linked wallet is unverified', () => {
    const out = reconcileWalletState(
      { walletAddress: null, evmAddress: EVM },
      me([wallet('eip155', EVM, false)]),
    )
    expect(out.evmAddress).toBeNull()
  })

  test('matches EVM addresses case-insensitively', () => {
    const out = reconcileWalletState(
      { walletAddress: null, evmAddress: EVM.toLowerCase() },
      me([wallet('eip155', EVM.toUpperCase())]),
    )
    expect(out.evmAddress).toBe(EVM.toLowerCase())
  })
})

describe('isRetriableMeError', () => {
  test('does NOT retry a terminal auth failure (401/403)', () => {
    expect(isRetriableMeError(new ApiClientError(401, 'Unauthorized', 'no'))).toBe(false)
    expect(isRetriableMeError(new ApiClientError(403, 'Forbidden', 'no'))).toBe(false)
  })

  test('retries a transient server/transport failure', () => {
    expect(isRetriableMeError(new ApiClientError(500, 'Server', 'boom'))).toBe(true)
    expect(isRetriableMeError(new ApiClientError(0, 'Network', 'down'))).toBe(true)
  })

  test('retries a non-ApiClientError (network) error', () => {
    expect(isRetriableMeError(new Error('Network request failed'))).toBe(true)
  })
})
