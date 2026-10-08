import { act, fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { NATIVE_GAS_COPY } from '@tenda/shared'
import { NativeGasConfirmationHost } from '../NativeGasConfirmationHost'
import { useNativeGasConfirmation } from '@/wallet/native-gas-confirmation'

describe('native gas confirmation', () => {
  it('uses the app dialog to explain and approve the fee-asset change', async () => {
    render(<NativeGasConfirmationHost />)
    let pending = Promise.resolve()
    act(() => { pending = useNativeGasConfirmation.getState().request() })
    expect(screen.getByRole('alertdialog', { name: NATIVE_GAS_COPY.title })).toBeInTheDocument()
    expect(screen.getByText(NATIVE_GAS_COPY.message)).toBeInTheDocument()
    await expect(useNativeGasConfirmation.getState().request()).rejects.toMatchObject({ code: 'network' })
    fireEvent.click(screen.getByRole('button', { name: NATIVE_GAS_COPY.confirmLabel }))
    await expect(pending).resolves.toBeUndefined()
    expect(screen.queryByRole('alertdialog')).toBeNull()
    act(() => useNativeGasConfirmation.getState().settle(false))
  })

  it.each(['Cancel', 'Escape', 'backdrop', 'unmount'])('declines on %s without leaving a pending request', async method => {
    const ui = render(<NativeGasConfirmationHost />)
    let pending = Promise.resolve()
    act(() => { pending = useNativeGasConfirmation.getState().request() })
    const rejected = expect(pending).rejects.toMatchObject({ code: 'declined' })
    if (method === 'Cancel') fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    else if (method === 'Escape') fireEvent.keyDown(window, { key: 'Escape' })
    else if (method === 'backdrop') fireEvent.click(screen.getByRole('presentation'))
    else ui.unmount()
    await rejected
    expect(useNativeGasConfirmation.getState().pending).toBeNull()
  })
})
