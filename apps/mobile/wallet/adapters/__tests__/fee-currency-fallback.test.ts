jest.mock('../../reown/connection-signal', () => ({
  connectionSignal: {
    getProvider: jest.fn(), getAccount: jest.fn(), getPeerRedirect: jest.fn(),
    disconnect: jest.fn(),
  },
}))
jest.mock('../../reown/config', () => ({ reownConfigured: true }))

import { useNativeGasConfirmation } from '../../native-gas-confirmation'
import { sendEvmTransaction } from '../walletconnect'
import { rejectsFeeCurrency } from '@tenda/shared'
import { connectionSignal } from '../../reown/connection-signal'

const tx = { from: '0xA', to: '0xB', data: '0x', value: '0', chainId: 'eip155:42220', feeCurrency: '0xAdapter' }
const unsupported = new Error('Invalid params feeCurrency - Expected a value of type `never`, but received: `"0xAdapter"`')
const request = jest.fn()

beforeEach(() => {
  jest.restoreAllMocks()
  request.mockReset()
  jest.mocked(connectionSignal.getProvider).mockReturnValue({ request })
  jest.mocked(connectionSignal.getAccount).mockReturnValue(null)
})

function consent(button: number) {
  jest.spyOn(useNativeGasConfirmation.getState(), 'request').mockImplementation(() =>
    button === 1 ? Promise.resolve() : Promise.reject({ code: 'declined' }))
}

test('confirmed fallback delegates gas handling to the wallet without balance or fee RPC reads', async () => {
  consent(1)
  request.mockRejectedValueOnce(unsupported).mockResolvedValueOnce('0xhash')
  await expect(sendEvmTransaction(tx)).resolves.toBe('0xhash')
  expect(request).toHaveBeenCalledTimes(2)
  expect(request).toHaveBeenLastCalledWith({
    method: 'eth_sendTransaction', params: [{ from: tx.from, to: tx.to, data: tx.data, value: '0x0' }],
  }, tx.chainId)
})

test('cancel prevents reads and retry', async () => {
  consent(0)
  request.mockRejectedValueOnce(unsupported)
  await expect(sendEvmTransaction(tx)).rejects.toMatchObject({ code: 'declined' })
  expect(request).toHaveBeenCalledTimes(1)
})

test('dismiss prevents retry', async () => {
  consent(0)
  request.mockRejectedValueOnce(unsupported)
  await expect(sendEvmTransaction(tx)).rejects.toMatchObject({ code: 'declined' })
  expect(request).toHaveBeenCalledTimes(1)
})

test('wallet gas errors propagate without a further retry', async () => {
  consent(1)
  const error = new Error('insufficient funds for gas')
  request.mockRejectedValueOnce(unsupported).mockRejectedValueOnce(error)
  await expect(sendEvmTransaction(tx)).rejects.toBe(error)
  expect(request).toHaveBeenCalledTimes(2)
})

test.each([
  new Error('timeout'), new Error('execution reverted'),
  { code: 4001, message: unsupported.message }, new Error('Invalid params feeCurrency: invalid address'),
])('other failures never prompt or retry: %s', async error => {
  const prompt = jest.spyOn(useNativeGasConfirmation.getState(), 'request')
  request.mockRejectedValueOnce(error)
  await expect(sendEvmTransaction(tx)).rejects.toBe(error)
  expect(prompt).not.toHaveBeenCalled()
  expect(request).toHaveBeenCalledTimes(1)
})

test('standard transactions do not retry even on a misleading feeCurrency error', async () => {
  request.mockRejectedValueOnce(unsupported)
  await expect(sendEvmTransaction({ ...tx, feeCurrency: undefined })).rejects.toBe(unsupported)
  expect(request).toHaveBeenCalledTimes(1)
})

test.each([null, 'error', {}, { message: 42 }])('malformed provider errors are not unsupported-field rejections', error => {
  expect(rejectsFeeCurrency(error)).toBe(false)
})
