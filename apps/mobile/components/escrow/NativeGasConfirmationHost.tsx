import { useEffect } from 'react'
import { NATIVE_GAS_COPY } from '@tenda/shared'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { useNativeGasConfirmation } from '@/wallet/native-gas-confirmation'

export function NativeGasConfirmationHost() {
  const visible = useNativeGasConfirmation(state => state.pending !== null)
  const settle = useNativeGasConfirmation(state => state.settle)
  useEffect(() => () => settle(false), [settle])
  return (
    <ConfirmDialog
      visible={visible}
      title={NATIVE_GAS_COPY.title}
      message={NATIVE_GAS_COPY.message}
      confirmLabel={NATIVE_GAS_COPY.confirmLabel}
      onConfirm={() => settle(true)}
      onCancel={() => settle(false)}
    />
  )
}
