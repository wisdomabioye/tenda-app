/**
 * Wallet sign-in / linking orchestration (Stage 2). Drives the nonce↔server
 * exchange through a FAKE WalletAdapter so both namespaces (solana, eip155),
 * the decline→null path, and server-error propagation are exercised without a
 * native transport. Asserts the server always receives the canonical,
 * server-registered chain id per namespace (WALLET_CHAINS) — NOT whatever
 * chainId the account happens to carry.
 */
import type { ImageRequireSource } from 'react-native'

jest.mock('@/api/client', () => ({
  api: {
    auth: {
      nonce: jest.fn(),
      wallet: jest.fn(),
      linkWallet: jest.fn(),
    },
  },
}))

import { api } from '@/api/client'
import { WALLET_CHAINS } from '@/wallet/config'
import { signInWithWallet, linkWalletWith } from '@/wallet/auth'
import type { WalletAdapter, AuthenticateResult } from '@/wallet/adapters/types'
import type { Namespace, SpikeAccount, SignMessageResult } from '@/wallet/types'
import type { AuthResponse } from '@tenda/shared'

const nonceMock = api.auth.nonce as jest.Mock
const walletMock = api.auth.wallet as jest.Mock
const linkWalletMock = api.auth.linkWallet as jest.Mock

const AUTH_RESPONSE: AuthResponse = {
  token: 'jwt.token.here',
  // user shape is opaque to this module; a minimal stand-in keeps the type happy.
  user: { id: 'u1' } as AuthResponse['user'],
}

function accountFor(namespace: Namespace): SpikeAccount {
  return namespace === 'solana'
    ? {
        namespace,
        // Deliberately a DIFFERENT chainId than WALLET_CHAINS.solana — proves the
        // orchestrator pins the registered chain id, not the account's own.
        chainId: 'solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp',
        address: 'So1anaAddr111111111111111111111111111111111',
        walletId: 'phantom',
      }
    : {
        namespace,
        chainId: 'eip155:1',
        address: '0xAbC0000000000000000000000000000000000001',
        walletId: 'metamask',
      }
}

/**
 * Fake adapter whose `authenticate` runs the real buildMessage callback (so we
 * can assert the message embeds the canonical chain id) and returns a canned
 * signature — or null to simulate a user decline.
 */
function fakeAdapter(
  account: SpikeAccount,
  behaviour: { decline?: boolean } = {},
): WalletAdapter & { lastOpts?: { forceFresh?: boolean } } {
  const adapter: WalletAdapter & { lastOpts?: { forceFresh?: boolean } } = {
    id: account.walletId,
    name: account.walletId,
    iconSource: 0 as ImageRequireSource,
    namespaces: [account.namespace],
    isAvailable: jest.fn(async () => true),
    isInstalled: jest.fn(async () => true),
    connect: jest.fn(async () => account),
    signMessage: jest.fn(
      async (_a: SpikeAccount, message: string): Promise<SignMessageResult> => ({
        signature: 'sig',
        message,
      }),
    ),
    authenticate: jest.fn(
      async (
        buildMessage: (a: SpikeAccount) => string,
        opts?: { forceFresh?: boolean },
      ): Promise<AuthenticateResult | null> => {
        adapter.lastOpts = opts
        if (behaviour.decline) return null
        return { account, signature: 'sig', message: buildMessage(account) }
      },
    ),
    disconnect: jest.fn(async () => {}),
    getRestoredAccount: jest.fn(async () => null),
  }
  return adapter
}

beforeEach(() => {
  nonceMock.mockResolvedValue({ nonce: 'NONCE-123' })
  walletMock.mockResolvedValue(AUTH_RESPONSE)
  linkWalletMock.mockResolvedValue({ wallet: { address: 'x' } })
})

describe('signInWithWallet', () => {
  it.each<Namespace>(['solana', 'eip155'])(
    'signs in over the %s namespace with the registered chain id',
    async (namespace) => {
      const account = accountFor(namespace)
      const adapter = fakeAdapter(account)

      const result = await signInWithWallet(adapter)

      expect(result).toEqual({ auth: AUTH_RESPONSE, account })
      expect(nonceMock).toHaveBeenCalledTimes(1)
      // The body's chain_id is the canonical registered id, not account.chainId.
      expect(walletMock).toHaveBeenCalledWith(
        expect.objectContaining({
          chain_id: WALLET_CHAINS[namespace],
          address: account.address,
          signature: 'sig',
          message: expect.stringContaining(WALLET_CHAINS[namespace]),
        }),
      )
      // No forceFresh on sign-in.
      expect(adapter.lastOpts).toBeUndefined()
    },
  )

  it('forwards is_seeker and country only when provided', async () => {
    const adapter = fakeAdapter(accountFor('solana'))
    await signInWithWallet(adapter, { is_seeker: true, country: 'NG' })
    expect(walletMock).toHaveBeenCalledWith(
      expect.objectContaining({ is_seeker: true, country: 'NG' }),
    )

    walletMock.mockClear()
    await signInWithWallet(fakeAdapter(accountFor('solana')))
    const body = walletMock.mock.calls[0][0]
    expect(body).not.toHaveProperty('is_seeker')
    expect(body).not.toHaveProperty('country')
  })

  it('returns null on user decline and never calls the server', async () => {
    const adapter = fakeAdapter(accountFor('eip155'), { decline: true })
    expect(await signInWithWallet(adapter)).toBeNull()
    expect(walletMock).not.toHaveBeenCalled()
  })

  it('propagates a server failure', async () => {
    walletMock.mockRejectedValueOnce(new Error('401 unauthorized'))
    await expect(signInWithWallet(fakeAdapter(accountFor('solana')))).rejects.toThrow(
      '401 unauthorized',
    )
  })

  it('propagates a nonce-fetch failure before touching the wallet', async () => {
    nonceMock.mockRejectedValueOnce(new Error('nonce down'))
    const adapter = fakeAdapter(accountFor('solana'))
    await expect(signInWithWallet(adapter)).rejects.toThrow('nonce down')
    expect(adapter.authenticate).not.toHaveBeenCalled()
  })
})

describe('linkWalletWith', () => {
  it.each<Namespace>(['solana', 'eip155'])(
    'links a %s wallet with forceFresh and the registered chain id',
    async (namespace) => {
      const account = accountFor(namespace)
      const adapter = fakeAdapter(account)

      const linked = await linkWalletWith(adapter)

      expect(linked).toEqual(account)
      expect(adapter.lastOpts).toEqual({ forceFresh: true })
      expect(linkWalletMock).toHaveBeenCalledWith(
        expect.objectContaining({
          chain_id: WALLET_CHAINS[namespace],
          address: account.address,
          signature: 'sig',
          message: expect.stringContaining(WALLET_CHAINS[namespace]),
        }),
      )
      expect(walletMock).not.toHaveBeenCalled()
    },
  )

  it('returns null on decline and never links', async () => {
    const adapter = fakeAdapter(accountFor('eip155'), { decline: true })
    expect(await linkWalletWith(adapter)).toBeNull()
    expect(linkWalletMock).not.toHaveBeenCalled()
  })

  it('propagates a server failure during link', async () => {
    linkWalletMock.mockRejectedValueOnce(new Error('409 already linked'))
    await expect(linkWalletWith(fakeAdapter(accountFor('solana')))).rejects.toThrow(
      '409 already linked',
    )
  })
})
