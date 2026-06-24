/**
 * WalletConnect (Reown) EVM adapter. The bridge (`reown/connection-signal`) and
 * Reown config are mocked so we exercise the adapter's own logic — the
 * personal_sign / eth_sendTransaction request shapes, decline→null mapping, and
 * the direct-RPC receipt poll — without AppKit or a device.
 */
// Defined inside the factory (jest hoists jest.mock above this file's consts,
// so any outer reference would still be in its TDZ when the factory runs); the
// jest.fns are retrieved off the imported mocked object below.
jest.mock('../../reown/connection-signal', () => ({
  connectionSignal: {
    connect: jest.fn(),
    disconnect: jest.fn(() => Promise.resolve()),
    getProvider: jest.fn(),
    getAccount: jest.fn(),
  },
}))
let mockReownConfigured = true
jest.mock('../../reown/config', () => ({
  get reownConfigured() {
    return mockReownConfigured
  },
}))

import { Buffer } from 'buffer'
import {
  walletConnectAdapter,
  sendEvmTransaction,
  getEvmTransactionStatus,
} from '../walletconnect'
import { connectionSignal } from '../../reown/connection-signal'
import { WalletError } from '@/wallet/errors'
import type { SpikeAccount } from '../../types'

const mockConnect = connectionSignal.connect as jest.Mock
const mockDisconnect = connectionSignal.disconnect as jest.Mock
const mockGetProvider = connectionSignal.getProvider as jest.Mock
const mockGetAccount = connectionSignal.getAccount as jest.Mock

const account: SpikeAccount = {
  namespace: 'eip155',
  chainId: 'eip155:8453',
  address: '0xABC',
  walletId: 'walletconnect',
}

function mockProvider(request: jest.Mock) {
  mockGetProvider.mockReturnValue({ request })
}

describe('walletConnectAdapter metadata', () => {
  it('is an eip155 aggregator with a tagline and no bundled icon', () => {
    expect(walletConnectAdapter.id).toBe('walletconnect')
    expect(walletConnectAdapter.name).toBe('EVM Wallet')
    expect(walletConnectAdapter.tagline).toBeTruthy()
    expect(walletConnectAdapter.namespaces).toEqual(['eip155'])
    expect(walletConnectAdapter.iconSource).toBeUndefined()
  })

  it('is available when Reown is configured and always reports installed', async () => {
    await expect(walletConnectAdapter.isAvailable()).resolves.toBe(true)
    await expect(walletConnectAdapter.isInstalled()).resolves.toBe(true)
  })

  it('delegates connect / disconnect / getRestoredAccount to the bridge', async () => {
    mockConnect.mockResolvedValueOnce(account)
    await expect(walletConnectAdapter.connect()).resolves.toBe(account)

    await walletConnectAdapter.disconnect()
    expect(mockDisconnect).toHaveBeenCalled()

    mockGetAccount.mockReturnValueOnce(account)
    await expect(walletConnectAdapter.getRestoredAccount()).resolves.toBe(account)
  })
})

describe('signMessage', () => {
  it('requests personal_sign with the hex-encoded message and address', async () => {
    const request = jest.fn().mockResolvedValue('0xsignature')
    mockProvider(request)
    const result = await walletConnectAdapter.signMessage(account, 'hello')
    expect(result).toEqual({ signature: '0xsignature', message: 'hello' })
    expect(request).toHaveBeenCalledWith({
      method: 'personal_sign',
      params: ['0x' + Buffer.from('hello', 'utf8').toString('hex'), '0xABC'],
    })
  })

  it('throws when no provider is connected', async () => {
    mockGetProvider.mockReturnValue(undefined)
    await expect(walletConnectAdapter.signMessage(account, 'hi')).rejects.toBeInstanceOf(WalletError)
    await expect(walletConnectAdapter.signMessage(account, 'hi')).rejects.toMatchObject({ code: 'network' })
  })

  it('throws when the wallet returns a non-string signature', async () => {
    mockProvider(jest.fn().mockResolvedValue(42))
    await expect(walletConnectAdapter.signMessage(account, 'hi')).rejects.toThrow('non-string signature')
  })
})

describe('authenticate', () => {
  it('connects, signs the built message, and returns the bundle', async () => {
    mockConnect.mockResolvedValueOnce(account)
    mockProvider(jest.fn().mockResolvedValue('0xsig'))
    const result = await walletConnectAdapter.authenticate(() => 'MESSAGE')
    expect(result).toEqual({ account, signature: '0xsig', message: 'MESSAGE' })
  })

  it('plain login does NOT disconnect first (reuses a restored session — no blocking round-trip)', async () => {
    // Login passes no opts → connectThenSign skips the disconnect. Logout clears
    // the WC session so a stale one can't be reused across accounts.
    mockConnect.mockResolvedValueOnce(account)
    mockProvider(jest.fn().mockResolvedValue('0xsig'))
    await walletConnectAdapter.authenticate(() => 'm')
    expect(mockDisconnect).not.toHaveBeenCalled()
  })

  it('returns null when the user declines the connection', async () => {
    mockConnect.mockRejectedValueOnce(new WalletError('declined', 'nope'))
    await expect(walletConnectAdapter.authenticate(() => 'm')).resolves.toBeNull()
  })

  it('returns null when the user rejects the signature (EIP-1193 4001)', async () => {
    mockConnect.mockResolvedValueOnce(account)
    mockProvider(jest.fn().mockRejectedValue({ code: 4001, message: 'user rejected' }))
    await expect(walletConnectAdapter.authenticate(() => 'm')).resolves.toBeNull()
  })

  it('disconnects first for linking too (forceFresh)', async () => {
    mockConnect.mockResolvedValueOnce(account)
    mockProvider(jest.fn().mockResolvedValue('0xsig'))
    await walletConnectAdapter.authenticate(() => 'm', { forceFresh: true })
    expect(mockDisconnect).toHaveBeenCalled()
  })
})

describe('sendEvmTransaction', () => {
  it('sends eth_sendTransaction with hex value on the chain scope', async () => {
    const request = jest.fn().mockResolvedValue('0xhash')
    mockProvider(request)
    const hash = await sendEvmTransaction({
      from: '0xABC',
      to: '0xDEF',
      data: '0x',
      value: '1000',
      chainId: 'eip155:8453',
    })
    expect(hash).toBe('0xhash')
    expect(request).toHaveBeenCalledWith(
      {
        method: 'eth_sendTransaction',
        params: [{ from: '0xABC', to: '0xDEF', data: '0x', value: '0x3e8' }],
      },
      'eip155:8453',
    )
  })

  it('includes feeCurrency for CELO and defaults the scope to the primary chain', async () => {
    const request = jest.fn().mockResolvedValue('0xhash')
    mockProvider(request)
    await sendEvmTransaction({ from: '0xA', to: '0xB', data: '0x', value: '0', feeCurrency: '0xcUSD' })
    const [args, scope] = request.mock.calls[0]
    expect(args.params[0]).toMatchObject({ feeCurrency: '0xcUSD', value: '0x0' })
    expect(scope).toMatch(/^eip155:/)
  })

  it('throws when no provider is connected', async () => {
    mockGetProvider.mockReturnValue(undefined)
    await expect(
      sendEvmTransaction({ from: '0xA', to: '0xB', data: '0x', value: '0' }),
    ).rejects.toMatchObject({ code: 'network' })
  })

  it('throws when the wallet returns a non-string hash', async () => {
    mockProvider(jest.fn().mockResolvedValue(null))
    await expect(
      sendEvmTransaction({ from: '0xA', to: '0xB', data: '0x', value: '0' }),
    ).rejects.toThrow('non-string tx hash')
  })
})

describe('getEvmTransactionStatus', () => {
  const fetchMock = jest.fn()
  beforeEach(() => {
    fetchMock.mockReset()
    global.fetch = fetchMock as unknown as typeof fetch
  })

  function respondWith(result: unknown): void {
    fetchMock.mockResolvedValue({ json: async () => ({ jsonrpc: '2.0', id: 1, result }) })
  }

  it('queries the primary chain RPC with eth_getTransactionReceipt', async () => {
    respondWith({ status: '0x1' })
    await getEvmTransactionStatus('0xtx')
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toMatch(/^https?:\/\//)
    expect(JSON.parse(init.body)).toMatchObject({
      method: 'eth_getTransactionReceipt',
      params: ['0xtx'],
    })
  })

  it('maps receipt status 0x1 → confirmed', async () => {
    respondWith({ status: '0x1' })
    await expect(getEvmTransactionStatus('0xtx')).resolves.toBe('confirmed')
  })

  it('maps receipt status 0x0 → failed', async () => {
    respondWith({ status: '0x0' })
    await expect(getEvmTransactionStatus('0xtx')).resolves.toBe('failed')
  })

  it('returns not_found when the receipt is null (still pending)', async () => {
    respondWith(null)
    await expect(getEvmTransactionStatus('0xtx')).resolves.toBe('not_found')
  })

  it('returns not_found when the RPC body has no result field', async () => {
    fetchMock.mockResolvedValue({ json: async () => ({ jsonrpc: '2.0', id: 1 }) })
    await expect(getEvmTransactionStatus('0xtx')).resolves.toBe('not_found')
  })

  it('returns not_found for an unknown receipt status', async () => {
    respondWith({ status: '0x2' })
    await expect(getEvmTransactionStatus('0xtx')).resolves.toBe('not_found')
  })
})

describe('walletConnectAdapter availability when Reown is unconfigured', () => {
  afterEach(() => {
    mockReownConfigured = true
  })

  it('reports isAvailable false', async () => {
    mockReownConfigured = false
    await expect(walletConnectAdapter.isAvailable()).resolves.toBe(false)
  })
})
