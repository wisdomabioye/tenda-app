/**
 * Auth store — wallet sign-in + session lifecycle (Stage 3). Covers the
 * namespace-aware address publishing (Solana → walletAddress + SecureStore;
 * EVM → evmAddress, no Solana persist), decline → false, server-error
 * propagation, logout reset, and loadSession's three branches (no-jwt,
 * happy, 401-clears vs transient-network-keeps).
 */
import type { ImageRequireSource } from 'react-native'
import type { AuthResponse } from '@tenda/shared'
import type { WalletAdapter } from '@/wallet/adapters/types'
import type { Namespace, SpikeAccount } from '@/wallet/types'

jest.mock('@/wallet/auth', () => ({
  signInWithWallet: jest.fn(),
  linkWalletWith: jest.fn(),
}))

jest.mock('@/api/client', () => {
  // Defined inside the factory (jest hoists mocks above imports — an
  // out-of-scope class reference is disallowed). The store's `instanceof
  // ApiClientError` matches because both sides resolve to this same class.
  class ApiClientError extends Error {
    statusCode: number
    constructor(statusCode: number, error: string, message: string) {
      super(message)
      this.statusCode = statusCode
    }
  }
  return {
    api: {
      auth: { me: jest.fn() },
      users: { me: jest.fn() },
    },
    ApiClientError,
  }
})

jest.mock('@/lib/secure-store', () => ({
  getJwtToken: jest.fn(),
  setJwtToken: jest.fn(async () => {}),
  getWalletAddress: jest.fn(),
  setWalletAddress: jest.fn(async () => {}),
  clearAuthStorage: jest.fn(async () => {}),
}))

jest.mock('@/stores/pending-sync.store', () => ({
  usePendingSyncStore: { getState: () => ({ clear: jest.fn(async () => {}) }) },
}))
jest.mock('@/stores/exchange-market.store', () => ({
  useExchangeMarketStore: { getState: () => ({ clear: jest.fn() }) },
}))

import { useAuthStore } from '@/stores/auth.store'
import { signInWithWallet as walletSignIn } from '@/wallet/auth'
import { api, ApiClientError } from '@/api/client'
import { getJwtToken, getWalletAddress, setWalletAddress, setJwtToken } from '@/lib/secure-store'

const walletSignInMock = walletSignIn as jest.Mock
const meMock = api.auth.me as jest.Mock
const usersMeMock = api.users.me as jest.Mock
const getJwt = getJwtToken as jest.Mock
const getAddr = getWalletAddress as jest.Mock
const setAddr = setWalletAddress as jest.Mock
const setJwt = setJwtToken as jest.Mock

const USER: AuthResponse['user'] = {
  id: 'u1',
  first_name: 'Ada',
  last_name: 'Lovelace',
} as AuthResponse['user']

const AUTH: AuthResponse = { token: 'jwt-123', user: USER }

function account(namespace: Namespace): SpikeAccount {
  return namespace === 'solana'
    ? { namespace, chainId: 'solana:devnet', address: 'SoLaNaAddr', walletId: 'solana-mwa' }
    : { namespace, chainId: 'eip155:84532', address: '0xEvmAddr', walletId: 'metamask' }
}

function stubAdapter(): WalletAdapter {
  return {
    id: 'solana-mwa',
    name: 'Solana Wallet',
    iconSource: 0 as ImageRequireSource,
    namespaces: ['solana'],
    isAvailable: jest.fn(async () => true),
    isInstalled: jest.fn(async () => true),
    connect: jest.fn(),
    signMessage: jest.fn(),
    authenticate: jest.fn(),
    disconnect: jest.fn(async () => {}),
    getRestoredAccount: jest.fn(async () => null),
  }
}

const INITIAL = {
  user: null,
  jwt: null,
  walletAddress: null,
  evmAddress: null,
  isAuthenticated: false,
  isLoading: true,
  wallets: [],
  profileComplete: null,
  phoneVerified: false,
}

beforeEach(() => {
  useAuthStore.setState(INITIAL)
  meMock.mockResolvedValue(USER)
  usersMeMock.mockResolvedValue({
    wallets: [],
    profile_complete: true,
    user: { phone_verified_at: null },
  })
})

describe('signInWithWallet', () => {
  it('publishes a Solana account to walletAddress + SecureStore', async () => {
    walletSignInMock.mockResolvedValue({ auth: AUTH, account: account('solana') })

    const ok = await useAuthStore.getState().signInWithWallet(stubAdapter(), { is_seeker: true })

    expect(ok).toBe(true)
    const s = useAuthStore.getState()
    expect(s.walletAddress).toBe('SoLaNaAddr')
    expect(s.evmAddress).toBeNull()
    expect(s.isAuthenticated).toBe(true)
    expect(s.profileComplete).toBe(true)
    expect(setJwt).toHaveBeenCalledWith('jwt-123')
    expect(setAddr).toHaveBeenCalledWith('SoLaNaAddr')
    expect(walletSignInMock).toHaveBeenCalledWith(expect.anything(), { is_seeker: true })
  })

  it('publishes an EVM account to evmAddress only — no Solana persist', async () => {
    walletSignInMock.mockResolvedValue({ auth: AUTH, account: account('eip155') })

    const ok = await useAuthStore.getState().signInWithWallet(stubAdapter())

    expect(ok).toBe(true)
    const s = useAuthStore.getState()
    expect(s.evmAddress).toBe('0xEvmAddr')
    expect(s.walletAddress).toBeNull()
    expect(setAddr).not.toHaveBeenCalled()
  })

  it('marks profileComplete false (sign-in derived) when names are missing', async () => {
    walletSignInMock.mockResolvedValue({
      auth: { token: 't', user: { id: 'u2' } as AuthResponse['user'] },
      account: account('solana'),
    })
    // Background refreshMe fails → the value derived at sign-in is the fallback.
    usersMeMock.mockRejectedValueOnce(new Error('me down'))
    await useAuthStore.getState().signInWithWallet(stubAdapter())
    expect(useAuthStore.getState().profileComplete).toBe(false)
  })

  it('returns false on decline and leaves the session untouched', async () => {
    walletSignInMock.mockResolvedValue(null)
    const ok = await useAuthStore.getState().signInWithWallet(stubAdapter())
    expect(ok).toBe(false)
    expect(useAuthStore.getState().isAuthenticated).toBe(false)
    expect(setJwt).not.toHaveBeenCalled()
  })

  it('propagates a server/transport failure', async () => {
    walletSignInMock.mockRejectedValue(new Error('500 boom'))
    await expect(useAuthStore.getState().signInWithWallet(stubAdapter())).rejects.toThrow('500 boom')
  })
})

describe('logout', () => {
  it('clears credentials and session state', async () => {
    useAuthStore.setState({
      user: USER,
      jwt: 'jwt-123',
      walletAddress: 'SoLaNaAddr',
      evmAddress: '0xEvmAddr',
      isAuthenticated: true,
    })
    await useAuthStore.getState().logout()
    const s = useAuthStore.getState()
    expect(s.user).toBeNull()
    expect(s.jwt).toBeNull()
    expect(s.walletAddress).toBeNull()
    expect(s.evmAddress).toBeNull()
    expect(s.isAuthenticated).toBe(false)
  })
})

describe('loadSession', () => {
  it('settles unauthenticated when no jwt is stored', async () => {
    getJwt.mockResolvedValue(null)
    getAddr.mockResolvedValue(null)
    await useAuthStore.getState().loadSession()
    const s = useAuthStore.getState()
    expect(s.isAuthenticated).toBe(false)
    expect(s.isLoading).toBe(false)
    expect(meMock).not.toHaveBeenCalled()
  })

  it('restores the session when a jwt resolves', async () => {
    getJwt.mockResolvedValue('jwt-123')
    getAddr.mockResolvedValue('SoLaNaAddr')
    await useAuthStore.getState().loadSession()
    const s = useAuthStore.getState()
    expect(s.isAuthenticated).toBe(true)
    expect(s.user).toEqual(USER)
    expect(s.walletAddress).toBe('SoLaNaAddr')
  })

  it('clears storage on a 401', async () => {
    getJwt.mockResolvedValue('stale')
    getAddr.mockResolvedValue('SoLaNaAddr')
    meMock.mockRejectedValueOnce(new ApiClientError(401, 'Unauthorized', 'unauthorized'))
    await useAuthStore.getState().loadSession()
    const s = useAuthStore.getState()
    expect(s.isAuthenticated).toBe(false)
    expect(s.jwt).toBeNull()
  })

  it('keeps credentials on a transient network error', async () => {
    getJwt.mockResolvedValue('jwt-123')
    getAddr.mockResolvedValue('SoLaNaAddr')
    meMock.mockRejectedValueOnce(new Error('network down'))
    await useAuthStore.getState().loadSession()
    const s = useAuthStore.getState()
    expect(s.jwt).toBe('jwt-123')
    expect(s.walletAddress).toBe('SoLaNaAddr')
    expect(s.isLoading).toBe(false)
  })
})
