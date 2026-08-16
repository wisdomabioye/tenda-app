/**
 * wallet/send/session — the signing-path guards: requireTxModal's disabled
 * branch, guardTxRequest's disconnect binding (peek-only), and
 * ensureSessionOn's connect-on-demand + linked-wallet trust rule.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ChainNamespace, LinkedWallet } from '@tenda/shared'

interface FakeModal {
  getAddress: (ns: ChainNamespace) => string | undefined
  getCaipNetwork: (ns: ChainNamespace) => { caipNetworkId?: string } | undefined
  subscribeAccount: ReturnType<typeof vi.fn>
  subscribeState: ReturnType<typeof vi.fn>
  open: ReturnType<typeof vi.fn>
  getProvider: ReturnType<typeof vi.fn>
  switchNetwork: ReturnType<typeof vi.fn>
  disconnect: ReturnType<typeof vi.fn>
}

function fakeModal(addresses: Partial<Record<ChainNamespace, string>> = {}): FakeModal {
  return {
    getAddress: (ns) => addresses[ns],
    getCaipNetwork: () => undefined,
    subscribeAccount: vi.fn(() => () => {}),
    subscribeState: vi.fn(() => () => {}),
    open: vi.fn(async () => {}),
    getProvider: vi.fn(() => undefined),
    switchNetwork: vi.fn(async () => {}),
    disconnect: vi.fn(async () => {}),
  }
}

const runtimeState = { current: null as { modal: FakeModal } | null, peek: null as { modal: FakeModal } | null }
vi.mock('@/wallet/runtime', () => ({
  loadWalletRuntime: async () =>
    runtimeState.current === null ? { status: 'disabled' } : { status: 'ready', runtime: runtimeState.current },
  peekWalletRuntime: () => runtimeState.peek,
}))

const waitForConnectionMock = vi.fn()
vi.mock('@/wallet/adapters/reown-connect', () => ({
  waitForConnection: (modal: unknown) => waitForConnectionMock(modal),
}))

const authState = { wallets: [] as LinkedWallet[] }
vi.mock('@/stores/auth.store', () => ({
  useAuthStore: { getState: () => authState },
}))

import { requireTxModal, guardTxRequest, ensureSessionOn } from '@/wallet/send/session'

function linked(ns: ChainNamespace, address: string): LinkedWallet {
  return { chain_ns: ns, address, is_primary: true, verified_at: '2026-01-01T00:00:00Z' }
}

beforeEach(() => {
  runtimeState.current = null
  runtimeState.peek = null
  authState.wallets = []
})

function boot(modal: FakeModal): void {
  runtimeState.current = { modal }
  runtimeState.peek = { modal }
}

describe('requireTxModal', () => {
  it('throws a typed no_wallet error when the build has no wallet config', async () => {
    await expect(requireTxModal()).rejects.toMatchObject({ name: 'WalletError', code: 'no_wallet' })
  })

  it('returns the booted modal', async () => {
    const modal = fakeModal()
    boot(modal)
    await expect(requireTxModal()).resolves.toBe(modal)
  })
})

describe('guardTxRequest', () => {
  it('passes the wallet result through', async () => {
    await expect(guardTxRequest(Promise.resolve('0xhash'))).resolves.toBe('0xhash')
  })

  it('a rejection propagates and the (peeked) session is left alone', async () => {
    const modal = fakeModal()
    boot(modal)
    await expect(guardTxRequest(Promise.reject(new Error('user rejected')))).rejects.toThrow('user rejected')
    expect(modal.disconnect).not.toHaveBeenCalled()
  })

  it('a Cancel abort disconnects the peeked session (never boots one)', async () => {
    const modal = fakeModal()
    // Booted earlier in the session: peek sees it.
    boot(modal)
    const { abortPendingWalletRequest } = await import('@tenda/shared')
    const guarded = guardTxRequest(new Promise<string>(() => {}))
    abortPendingWalletRequest()
    await expect(guarded).rejects.toMatchObject({ code: 'declined' })
    await vi.waitFor(() => expect(modal.disconnect).toHaveBeenCalledTimes(1))
  })

  it('abort with NO booted runtime does not throw (nothing to tear down)', async () => {
    const { abortPendingWalletRequest } = await import('@tenda/shared')
    const guarded = guardTxRequest(new Promise<string>(() => {}))
    abortPendingWalletRequest()
    await expect(guarded).rejects.toMatchObject({ code: 'declined' })
  })
})

describe('ensureSessionOn', () => {
  it('returns the live address when it is a verified linked wallet', async () => {
    boot(fakeModal({ eip155: '0xLive' }))
    authState.wallets = [linked('eip155', '0xLive')]
    await expect(ensureSessionOn('eip155')).resolves.toBe('0xLive')
    expect(waitForConnectionMock).not.toHaveBeenCalled()
  })

  it('opens the connect flow when no session is live, then re-reads the address', async () => {
    const modal = fakeModal()
    let connected = false
    modal.getAddress = ((ns: ChainNamespace) => (connected && ns === 'solana' ? 'SoL1' : undefined)) as FakeModal['getAddress']
    boot(modal)
    authState.wallets = [linked('solana', 'SoL1')]
    waitForConnectionMock.mockImplementation(async () => {
      connected = true
    })
    await expect(ensureSessionOn('solana')).resolves.toBe('SoL1')
    expect(waitForConnectionMock).toHaveBeenCalledTimes(1)
  })

  it('a dismissal in the connect flow propagates as the typed decline', async () => {
    boot(fakeModal())
    const { WalletError } = await import('@tenda/shared')
    waitForConnectionMock.mockRejectedValue(new WalletError('declined', 'closed'))
    await expect(ensureSessionOn('eip155')).rejects.toMatchObject({ code: 'declined' })
  })

  it('connecting a wallet on the WRONG namespace still fails with no_wallet', async () => {
    // User opened the modal and connected a Solana wallet while the flow
    // needed an EVM one — the address re-read stays empty for eip155.
    boot(fakeModal({ solana: 'SoL1' }))
    authState.wallets = [linked('solana', 'SoL1')]
    waitForConnectionMock.mockResolvedValue(undefined)
    await expect(ensureSessionOn('eip155')).rejects.toMatchObject({ code: 'no_wallet' })
  })

  it('a connected wallet that is NOT linked is refused — trust stays with wallets[]', async () => {
    boot(fakeModal({ eip155: '0xStranger' }))
    authState.wallets = [linked('eip155', '0xLinked')]
    await expect(ensureSessionOn('eip155')).rejects.toMatchObject({
      code: 'no_wallet',
      message: expect.stringMatching(/linked wallet/i),
    })
  })

  it('an unverified linked wallet does not count', async () => {
    boot(fakeModal({ eip155: '0xPending' }))
    authState.wallets = [{ chain_ns: 'eip155', address: '0xPending', is_primary: false, verified_at: null }]
    await expect(ensureSessionOn('eip155')).rejects.toMatchObject({ code: 'no_wallet' })
  })
})
