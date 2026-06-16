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
    PublicKey: class {},
    VersionedTransaction,
    Transaction,
  }
})

import { signAndSendStored } from '../solana-mwa'
import { WalletError } from '@/wallet/errors'
import { withMwaRetry } from '../mwa-shared'
import { Transaction } from '@solana/web3.js'

const STORAGE_KEY = 'wallet.solana-mwa.authToken'
const withRetryMock = withMwaRetry as jest.Mock

beforeEach(async () => {
  await AsyncStorage.clear()
  withRetryMock.mockReset()
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
