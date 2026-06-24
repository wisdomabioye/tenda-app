/**
 * UnsignedTx dispatcher (Stage 3). Verifies each kind routes to the right
 * transport and that the EVM `from` precedence (live session → verified linked
 * wallet → error) is correct. The Solana path now sources its session token
 * from the adapter (signAndSendStored), not the auth store.
 */
import type { LinkedWallet, UnsignedTx } from '@tenda/shared'

// dispatch only touches VersionedTransaction.deserialize — stub it so we never
// parse a real wire transaction. The fn is created INSIDE the factory (ESM
// imports run before any module-scope const, so an outer ref would be
// undefined at first require); we retrieve it from the mocked module below.
jest.mock('@solana/web3.js', () => ({
  VersionedTransaction: { deserialize: jest.fn(() => ({ __tx: true })) },
}))

jest.mock('@/wallet/adapters/solana-mwa', () => ({
  signAndSendStored: jest.fn(),
}))
jest.mock('@/wallet/adapters/walletconnect', () => ({
  sendEvmTransaction: jest.fn(),
}))
jest.mock('@/stores/auth.store', () => ({
  useAuthStore: { getState: jest.fn() },
}))
jest.mock('@/stores/escrow.store', () => ({
  useEscrowStore: { getState: jest.fn() },
}))

import {
  signAndSendUnsignedTx,
  signSendAndReport,
  UnsupportedUnsignedTxError,
} from '@/wallet/dispatch'
import { signAndSendStored } from '@/wallet/adapters/solana-mwa'
import { sendEvmTransaction } from '@/wallet/adapters/walletconnect'
import { useAuthStore } from '@/stores/auth.store'
import { useEscrowStore } from '@/stores/escrow.store'
import { VersionedTransaction } from '@solana/web3.js'

const mockDeserialize = VersionedTransaction.deserialize as jest.Mock
const storedMock = signAndSendStored as jest.Mock
const sendEvmMock = sendEvmTransaction as jest.Mock
const authStateMock = useAuthStore.getState as jest.Mock
const escrowStateMock = useEscrowStore.getState as jest.Mock

function evmWallet(over: Partial<LinkedWallet>): LinkedWallet {
  return {
    chain_ns: 'eip155',
    address: '0xLinked',
    is_primary: false,
    verified_at: '2026-01-01T00:00:00Z',
    ...over,
  } as LinkedWallet
}

const SOLANA_TX: UnsignedTx = {
  kind: 'solana-tx',
  tx_base64: 'AAAA',
  recent_blockhash: 'bh',
  last_valid_block_height: 1,
}

const EVM_TX: UnsignedTx = { kind: 'evm-tx', to: '0xTo', data: '0xData', value: '0' }

beforeEach(() => {
  authStateMock.mockReturnValue({ evmAddress: null, wallets: [] })
})

describe('signAndSendUnsignedTx — solana-tx', () => {
  it('deserializes the wire tx and delegates to the adapter-owned signer', async () => {
    storedMock.mockResolvedValue('sol-sig')
    const ref = await signAndSendUnsignedTx(SOLANA_TX, 'solana:devnet')
    expect(ref).toBe('sol-sig')
    expect(mockDeserialize).toHaveBeenCalledTimes(1)
    expect(storedMock).toHaveBeenCalledWith({ __tx: true })
  })
})

describe('signAndSendUnsignedTx — evm-tx from precedence', () => {
  it('prefers the live spike session (evmAddress)', async () => {
    authStateMock.mockReturnValue({
      evmAddress: '0xLive',
      wallets: [evmWallet({ address: '0xLinked', is_primary: true })],
    })
    sendEvmMock.mockResolvedValue('evm-ref')
    await signAndSendUnsignedTx(EVM_TX, 'eip155:84532')
    expect(sendEvmMock).toHaveBeenCalledWith(
      expect.objectContaining({ from: '0xLive', to: '0xTo', chainId: 'eip155:84532' }),
    )
  })

  it('falls back to the primary verified linked wallet', async () => {
    authStateMock.mockReturnValue({
      evmAddress: null,
      wallets: [
        evmWallet({ address: '0xSecondary' }),
        evmWallet({ address: '0xPrimary', is_primary: true }),
      ],
    })
    sendEvmMock.mockResolvedValue('evm-ref')
    await signAndSendUnsignedTx(EVM_TX, 'eip155:84532')
    expect(sendEvmMock).toHaveBeenCalledWith(expect.objectContaining({ from: '0xPrimary' }))
  })

  it('ignores unverified eip155 wallets in the fallback', async () => {
    authStateMock.mockReturnValue({
      evmAddress: null,
      wallets: [evmWallet({ address: '0xUnverified', verified_at: null })],
    })
    await expect(signAndSendUnsignedTx(EVM_TX, 'eip155:84532')).rejects.toThrow(
      'no EVM wallet connected',
    )
    expect(sendEvmMock).not.toHaveBeenCalled()
  })

  it('forwards fee_currency for CELO gas abstraction', async () => {
    authStateMock.mockReturnValue({ evmAddress: '0xLive', wallets: [] })
    sendEvmMock.mockResolvedValue('evm-ref')
    await signAndSendUnsignedTx({ ...EVM_TX, fee_currency: '0xcUSD' }, 'eip155:42220')
    expect(sendEvmMock).toHaveBeenCalledWith(
      expect.objectContaining({ feeCurrency: '0xcUSD' }),
    )
  })
})

describe('signAndSendUnsignedTx — evm-userop', () => {
  it('throws the typed unsupported error (blocked on the bundler config)', async () => {
    const userOp: UnsignedTx = {
      kind: 'evm-userop',
      user_op: {} as Extract<UnsignedTx, { kind: 'evm-userop' }>['user_op'],
      entry_point: '0xEntry',
    }
    await expect(signAndSendUnsignedTx(userOp)).rejects.toBeInstanceOf(UnsupportedUnsignedTxError)
  })
})

describe('signSendAndReport', () => {
  it('signs then reports the tx_ref to the escrow store', async () => {
    storedMock.mockResolvedValue('sol-sig')
    const reportTx = jest.fn(async () => {})
    escrowStateMock.mockReturnValue({ reportTx })

    const ref = await signSendAndReport({
      unsigned: SOLANA_TX,
      action: 'submit',
      chain_id: 'solana:devnet',
      escrow_id: 'esc-1',
    })

    expect(ref).toBe('sol-sig')
    expect(reportTx).toHaveBeenCalledWith({
      tx_ref: 'sol-sig',
      action: 'submit',
      chain_id: 'solana:devnet',
      escrow_id: 'esc-1',
    })
  })
})
