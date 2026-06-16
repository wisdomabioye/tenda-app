/**
 * solana-mwa.signAndSendStored (Stage 3). The adapter owns its MWA session
 * token (AsyncStorage) — dispatch reads it from here, not the auth store.
 * Verifies the no-session guard and the connect→sign→broadcast happy path.
 */
import AsyncStorage from '@react-native-async-storage/async-storage'

jest.mock('../mwa-shared', () => ({
  withMwaRetry: jest.fn(),
  authorizeSession: jest.fn(),
}))

jest.mock('@solana/web3.js', () => {
  class VersionedTransaction {}
  class Transaction {
    serialize() {
      return new Uint8Array([1, 2, 3])
    }
  }
  return {
    Connection: jest.fn().mockImplementation(() => ({
      sendRawTransaction: jest.fn(async () => 'broadcast-sig'),
    })),
    clusterApiUrl: () => 'http://rpc',
    PublicKey: class {
      toBase58() {
        return 'MockAddr'
      }
      toBytes() {
        return new Uint8Array(32)
      }
    },
    VersionedTransaction,
    Transaction,
  }
})

import { signAndSendStored, authenticate } from '../solana-mwa'
import { WalletError } from '@/wallet/errors'
import { withMwaRetry, authorizeSession } from '../mwa-shared'
import { Transaction } from '@solana/web3.js'
import type { SpikeAccount } from '../../types'

const STORAGE_KEY = 'wallet.solana-mwa.authToken'
const withRetryMock = withMwaRetry as jest.Mock
const authorizeMock = authorizeSession as jest.Mock

beforeEach(async () => {
  await AsyncStorage.clear()
  withRetryMock.mockReset()
  authorizeMock.mockReset()
})

describe('signAndSendStored', () => {
  it('throws a typed no_wallet error when there is no stored session', async () => {
    const tx = new Transaction()
    await expect(signAndSendStored(tx)).rejects.toBeInstanceOf(WalletError)
    await expect(signAndSendStored(tx)).rejects.toMatchObject({ code: 'no_wallet' })
  })

  it('signs with the stored token and returns the broadcast signature', async () => {
    await AsyncStorage.setItem(STORAGE_KEY, 'tok-1')
    const tx = new Transaction()
    // The adapter signs inside withMwaRetry's callback; the signed tx is what
    // gets serialized + broadcast. Return the same VersionedTransaction.
    withRetryMock.mockImplementation(async () => tx)

    const ref = await signAndSendStored(tx)

    expect(ref).toBe('broadcast-sig')
    expect(withRetryMock).toHaveBeenCalledTimes(1)
  })
})

describe('authenticate (one-shot, always-fresh)', () => {
  it('drops any stored session, authorizes fresh, signs once, returns the exact signed message', async () => {
    // A leftover token from a prior attempt must NOT trigger a reauthorize.
    await AsyncStorage.setItem(STORAGE_KEY, 'stale-token')
    authorizeMock.mockResolvedValue({ authToken: 'fresh-tok', addressBase64: 'AAAA' })

    const captured: { payload?: Uint8Array } = {}
    const wallet = {
      signMessages: jest.fn(async ({ payloads }: { addresses: string[]; payloads: Uint8Array[] }) => {
        captured.payload = payloads[0]
        return [new Uint8Array([9, 9, 9])]
      }),
    }
    // Single transact: run the op once against the fake wallet.
    withRetryMock.mockImplementation((op: (w: typeof wallet) => Promise<unknown>) => op(wallet))

    // buildMessage changes each call (mirrors buildAuthMessage's fresh Issued At)
    // so a build-once bug would surface as signed-message ≠ returned-message.
    let n = 0
    const buildMessage = (a: SpikeAccount): string => `MSG:${a.address}:${n++}`

    const result = await authenticate(buildMessage)
    if (result === null) throw new Error('expected an AuthenticateResult')

    // Fresh authorize (null token) — never reauthorize with the stale one.
    expect(authorizeMock).toHaveBeenCalledWith(wallet, null)
    // One wallet visit.
    expect(withRetryMock).toHaveBeenCalledTimes(1)
    // The exact bytes signed are what we return (build-once invariant).
    expect(new TextDecoder().decode(captured.payload)).toBe(result.message)
    expect(result.account.address).toBe('MockAddr')
    expect(result.account.namespace).toBe('solana')
    // Rotated token persisted, replacing the stale one.
    expect(await AsyncStorage.getItem(STORAGE_KEY)).toBe('fresh-tok')
  })

  it('returns null when the user declines', async () => {
    withRetryMock.mockRejectedValue(new WalletError('declined', 'no'))
    expect(await authenticate(() => 'm')).toBeNull()
  })

  it('rethrows non-decline errors', async () => {
    withRetryMock.mockRejectedValue(new Error('boom'))
    await expect(authenticate(() => 'm')).rejects.toThrow('boom')
  })
})
