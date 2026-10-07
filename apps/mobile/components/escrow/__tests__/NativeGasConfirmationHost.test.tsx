import React from 'react'
import { act, render, fireEvent } from '@testing-library/react-native'
import { NativeGasConfirmationHost } from '../NativeGasConfirmationHost'
import { useNativeGasConfirmation } from '@/wallet/native-gas-confirmation'

jest.mock('@/components/ui/ConfirmDialog', () => {
  const { View, Text, Pressable } = require('react-native')
  return {
    ConfirmDialog: ({ visible, title, message, onConfirm, onCancel }: {
      visible: boolean; title: string; message: string; onConfirm: () => void; onCancel: () => void
    }) => visible ? (
      <View><Text>{title}</Text><Text>{message}</Text>
        <Pressable onPress={onConfirm}><Text>Continue</Text></Pressable>
        <Pressable onPress={onCancel}><Text>Cancel</Text></Pressable>
      </View>
    ) : null,
  }
})

test('shared dialog resolves consent and closes', async () => {
  const ui = render(<NativeGasConfirmationHost />)
  let pending = Promise.resolve()
  act(() => { pending = useNativeGasConfirmation.getState().request() })
  expect(ui.getByText('Pay network fees in CELO')).toBeTruthy()
  fireEvent.press(ui.getByText('Continue'))
  await expect(pending).resolves.toBeUndefined()
  expect(ui.queryByText('Continue')).toBeNull()
})

test('cancel rejects consent and closes', async () => {
  const ui = render(<NativeGasConfirmationHost />)
  let pending = Promise.resolve()
  act(() => { pending = useNativeGasConfirmation.getState().request() })
  const result = expect(pending).rejects.toMatchObject({ code: 'declined' })
  fireEvent.press(ui.getByText('Cancel'))
  await result
  expect(ui.queryByText('Continue')).toBeNull()
})

test('unmount cancels pending consent and concurrent requests are rejected', async () => {
  const ui = render(<NativeGasConfirmationHost />)
  let pending = Promise.resolve()
  act(() => { pending = useNativeGasConfirmation.getState().request() })
  await expect(useNativeGasConfirmation.getState().request()).rejects.toMatchObject({ code: 'network' })
  const result = expect(pending).rejects.toMatchObject({ code: 'declined' })
  ui.unmount()
  await result
  expect(useNativeGasConfirmation.getState().pending).toBeNull()
})
