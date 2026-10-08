import { act, fireEvent, render, screen } from '@testing-library/react-native'
import { Modal } from 'react-native'

jest.mock('@/wallet/reown/connection-signal', () => ({
  connectionSignal: { getProvider: jest.fn(), getAccount: jest.fn(() => null),
    getPeerRedirect: jest.fn(), disconnect: jest.fn() },
}))
jest.mock('@/wallet/reown/config', () => ({ reownConfigured: true }))
jest.mock('react-native-unistyles', () => ({
  useUnistyles: () => ({ theme: { colors: {
    surface: { modal: '#fff' }, utility: { scrim: '#000' },
    border: { strong: '#ddd' }, content: { secondary: '#555' },
  } } }),
}))
// Only the styled button is substituted. The actual dialog, native Modal,
// host, consent store, wallet adapter and request guard stay connected.
jest.mock('@/components/ui/Button', () => {
  const { Pressable, Text } = require('react-native')
  return { Button: ({ children, onPress }: { children: React.ReactNode; onPress: () => void }) =>
    <Pressable onPress={onPress}><Text>{children}</Text></Pressable> }
})

import { NativeGasConfirmationHost } from '../NativeGasConfirmationHost'
import { useNativeGasConfirmation } from '@/wallet/native-gas-confirmation'
import { connectionSignal } from '@/wallet/reown/connection-signal'
import { sendEvmTransaction } from '@/wallet/adapters/walletconnect'
import { NATIVE_GAS_COPY } from '@tenda/shared'

const tx = { from: '0xA', to: '0xB', data: '0x1234', value: '10',
  chainId: 'eip155:42220', feeCurrency: '0xAdapter' }
const rejectedFee = { code: -32602,
  message: 'Invalid params\n\nfeeCurrency - Expected a value of type `never`, but received: `"0xAdapter"`' }

test.each(['approve', 'cancel', 'system back', 'unmount'])('real mobile dialog controls retry: %s', async decision => {
  const request = jest.fn().mockRejectedValueOnce(rejectedFee).mockResolvedValueOnce('0xhash')
  jest.mocked(connectionSignal.getProvider).mockReturnValue({ request })
  const ui = render(<NativeGasConfirmationHost />)
  const pending = sendEvmTransaction(tx)
  const outcome = decision === 'approve' ? expect(pending).resolves.toBe('0xhash')
    : expect(pending).rejects.toMatchObject({ code: 'declined' })
  await screen.findByText(NATIVE_GAS_COPY.message)
  expect(request).toHaveBeenCalledTimes(1)
  if (decision === 'unmount') {
    // Unmount flushes effect cleanup in its own act; do not await cleanup
    // inside an enclosing async act that prevents that effect from running.
    ui.unmount()
    await outcome
  } else await act(async () => {
    if (decision === 'approve') fireEvent.press(screen.getByText(NATIVE_GAS_COPY.confirmLabel))
    else if (decision === 'cancel') fireEvent.press(screen.getByText('Cancel'))
    else ui.UNSAFE_getByType(Modal).props.onRequestClose()
    await outcome
  })
  expect(request).toHaveBeenCalledTimes(decision === 'approve' ? 2 : 1)
  expect(useNativeGasConfirmation.getState().pending).toBeNull()
  if (decision === 'approve') expect(request).toHaveBeenLastCalledWith({
    method: 'eth_sendTransaction', params: [{ from: tx.from, to: tx.to, data: tx.data, value: '0xa' }],
  }, tx.chainId)
})
