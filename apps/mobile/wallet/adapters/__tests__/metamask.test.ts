/**
 * MetaMask adapter over @metamask/connect-multichain. The native relay/deeplink
 * transport is mocked (it can't run off-device); these exercise OUR mapping:
 * CAIP-10 account parsing, scope selection, invokeMethod request shaping, the
 * receipt-status mapping, and decline → null via connectThenSign.
 */

const mockClient = {
  connect: jest.fn(),
  disconnect: jest.fn(),
  invokeMethod: jest.fn(),
  provider: { getSession: jest.fn() },
}

// `virtual: true` — the package only ships a `react-native` build resolved by
// Metro's flat `nodeModulesPaths`; jest's stricter pnpm resolver can't find it,
// and we replace it wholesale here anyway, so we don't need the real module.
jest.mock(
  '@metamask/connect-multichain',
  () => ({
    createMultichainClient: jest.fn(async () => mockClient),
    // A decline is modelled as an error carrying `{ rejected: true }`.
    isRejectionError: (e: unknown) =>
      typeof e === 'object' && e !== null && (e as { rejected?: boolean }).rejected === true,
  }),
  { virtual: true },
)
jest.mock('react-native', () => ({ Linking: { openURL: jest.fn() } }))
jest.mock('../detect', () => ({ canOpenScheme: jest.fn(async () => true) }))
jest.mock('../../config', () => ({
  metadata: {
    name: 'Tenda',
    url: 'https://tendahq.com',
    iconUrl: 'https://tendahq.com/icon.png',
    redirectScheme: 'tenda',
  },
  WALLET_CHAINS: { eip155: 'eip155:8453', solana: 'solana:devnet' },
}))

import { metamaskAdapter, sendEvmTransaction, getEvmTransactionStatus } from '../metamask'
import { canOpenScheme } from '../detect'

const sessionWith = (scopes: Record<string, string[]>) => ({
  sessionScopes: Object.fromEntries(
    Object.entries(scopes).map(([scope, accounts]) => [scope, { methods: [], notifications: [], accounts }]),
  ),
})

beforeEach(() => {
  mockClient.connect.mockReset().mockResolvedValue(undefined)
  mockClient.disconnect.mockReset().mockResolvedValue(undefined)
  mockClient.invokeMethod.mockReset()
  mockClient.provider.getSession.mockReset()
  ;(canOpenScheme as jest.Mock).mockResolvedValue(true)
})

describe('connect', () => {
  it('authorizes the EVM scopes and returns the primary-chain account (CAIP-10 parsed)', async () => {
    mockClient.provider.getSession.mockResolvedValue(
      sessionWith({
        'eip155:1': ['eip155:1:0xMAINNET'],
        'eip155:8453': ['eip155:8453:0xBASE'],
      }),
    )

    const account = await metamaskAdapter.connect()

    expect(mockClient.connect).toHaveBeenCalledWith(
      ['eip155:1', 'eip155:8453', 'eip155:84532', 'eip155:42220'],
      [],
    )
    // Primary chain (WALLET_CHAINS.eip155 = eip155:8453) is preferred over mainnet.
    expect(account).toEqual({
      namespace: 'eip155',
      chainId: 'eip155:8453',
      address: '0xBASE',
      walletId: 'metamask',
    })
  })

  it('falls back to any authorized account when the primary chain has none', async () => {
    mockClient.provider.getSession.mockResolvedValue(sessionWith({ 'eip155:1': ['eip155:1:0xONLY'] }))
    const account = await metamaskAdapter.connect()
    expect(account.address).toBe('0xONLY')
    expect(account.chainId).toBe('eip155:1')
  })

  it('throws when MetaMask is not installed', async () => {
    ;(canOpenScheme as jest.Mock).mockResolvedValue(false)
    await expect(metamaskAdapter.connect()).rejects.toThrow('not installed')
    expect(mockClient.connect).not.toHaveBeenCalled()
  })

  it('throws when the session yields no account', async () => {
    mockClient.provider.getSession.mockResolvedValue(sessionWith({ 'eip155:8453': [] }))
    await expect(metamaskAdapter.connect()).rejects.toThrow('did not return an account')
  })
})

describe('signMessage', () => {
  const account = { namespace: 'eip155' as const, chainId: 'eip155:8453', address: '0xABC', walletId: 'metamask' }

  it('invokes personal_sign on the account scope with [hexMessage, address]', async () => {
    mockClient.invokeMethod.mockResolvedValue('0xsignature')
    const result = await metamaskAdapter.signMessage(account, 'hello')

    expect(mockClient.invokeMethod).toHaveBeenCalledWith({
      scope: 'eip155:8453',
      request: {
        method: 'personal_sign',
        params: ['0x' + Buffer.from('hello', 'utf8').toString('hex'), '0xABC'],
      },
    })
    expect(result).toEqual({ signature: '0xsignature', message: 'hello' })
  })

  it('throws on a non-string signature', async () => {
    mockClient.invokeMethod.mockResolvedValue({ not: 'a string' })
    await expect(metamaskAdapter.signMessage(account, 'hi')).rejects.toThrow('non-string signature')
  })
})

describe('transport-timeout reset', () => {
  const account = { namespace: 'eip155' as const, chainId: 'eip155:8453', address: '0xABC', walletId: 'metamask' }
  const timeoutErr = { name: 'TransportTimeoutError', message: 'Transport request timed out' }
  const rpcErr53 = { name: 'RPCErr53', message: 'RPC Client invoke method reason (Transport request timed out)' }

  it('tears the session down on a transport timeout, then rethrows it', async () => {
    mockClient.invokeMethod.mockRejectedValue(timeoutErr)
    await expect(metamaskAdapter.signMessage(account, 'hi')).rejects.toBe(timeoutErr)
    expect(mockClient.disconnect).toHaveBeenCalledTimes(1)
  })

  it('also resets on the RPCErr53 "Transport request timed out" variant', async () => {
    mockClient.invokeMethod.mockRejectedValue(rpcErr53)
    await expect(metamaskAdapter.signMessage(account, 'hi')).rejects.toBe(rpcErr53)
    expect(mockClient.disconnect).toHaveBeenCalledTimes(1)
  })

  it('does NOT reset on a decline (that maps to null) or other errors', async () => {
    // connect() must succeed first so the decline lands on the sign step.
    mockClient.provider.getSession.mockResolvedValue(sessionWith({ 'eip155:8453': ['eip155:8453:0xABC'] }))
    mockClient.invokeMethod.mockRejectedValue({ rejected: true })
    await expect(metamaskAdapter.authenticate(() => 'm')).resolves.toBeNull()
    // disconnect is only triggered by forceFresh/connectThenSign, never by the
    // decline path inside runWalletOp — so no timeout-reset disconnect happened.
    expect(mockClient.disconnect).not.toHaveBeenCalled()
  })

  it('swallows a failing reset and still surfaces the original timeout', async () => {
    mockClient.invokeMethod.mockRejectedValue(timeoutErr)
    mockClient.disconnect.mockRejectedValue(new Error('revoke failed'))
    await expect(metamaskAdapter.signMessage(account, 'hi')).rejects.toBe(timeoutErr)
  })
})

describe('authenticate (decline handling)', () => {
  it('resolves null when the wallet rejects the connect', async () => {
    mockClient.connect.mockRejectedValue({ rejected: true })
    const result = await metamaskAdapter.authenticate(() => 'msg')
    expect(result).toBeNull()
  })
})

describe('sendEvmTransaction', () => {
  it('invokes eth_sendTransaction on the target scope with a hex value', async () => {
    mockClient.invokeMethod.mockResolvedValue('0xtxhash')
    const hash = await sendEvmTransaction({
      from: '0xFROM',
      to: '0xTO',
      data: '0xdata',
      value: '1000000000000000000', // 1e18 wei
      chainId: 'eip155:42220',
      feeCurrency: '0xFEE',
    })

    expect(mockClient.invokeMethod).toHaveBeenCalledWith({
      scope: 'eip155:42220',
      request: {
        method: 'eth_sendTransaction',
        params: [
          { from: '0xFROM', to: '0xTO', data: '0xdata', value: '0xde0b6b3a7640000', feeCurrency: '0xFEE' },
        ],
      },
    })
    expect(hash).toBe('0xtxhash')
  })

  it('defaults to the primary scope and omits feeCurrency when not given', async () => {
    mockClient.invokeMethod.mockResolvedValue('0xtx')
    await sendEvmTransaction({ from: '0xF', to: '0xT', data: '0x', value: '0' })
    const call = mockClient.invokeMethod.mock.calls[0][0]
    expect(call.scope).toBe('eip155:8453')
    expect(call.request.params[0]).not.toHaveProperty('feeCurrency')
    expect(call.request.params[0].value).toBe('0x0')
  })
})

describe('getEvmTransactionStatus', () => {
  it.each([
    [{ status: '0x1' }, 'confirmed'],
    [{ status: '0x0' }, 'failed'],
    [null, 'not_found'],
    [{ status: '0x2' }, 'not_found'],
  ])('maps receipt %p → %s', async (receipt, expected) => {
    mockClient.invokeMethod.mockResolvedValue(receipt)
    await expect(getEvmTransactionStatus('0xhash')).resolves.toBe(expected)
  })
})

describe('getRestoredAccount', () => {
  it('returns the session account, or null when no session', async () => {
    mockClient.provider.getSession.mockResolvedValueOnce(sessionWith({ 'eip155:8453': ['eip155:8453:0xR'] }))
    await expect(metamaskAdapter.getRestoredAccount()).resolves.toMatchObject({ address: '0xR' })

    mockClient.provider.getSession.mockResolvedValueOnce(undefined)
    await expect(metamaskAdapter.getRestoredAccount()).resolves.toBeNull()
  })
})
