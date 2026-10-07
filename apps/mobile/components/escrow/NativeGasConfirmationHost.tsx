import { useEffect } from 'react'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { useNativeGasConfirmation } from '@/wallet/native-gas-confirmation'

export function NativeGasConfirmationHost() {
  const visible = useNativeGasConfirmation(state => state.pending !== null)
  const settle = useNativeGasConfirmation(state => state.settle)
  useEffect(() => () => settle(false), [settle])
  return (
    <ConfirmDialog
      visible={visible}
      title="Pay network fees in CELO"
      message="Your wallet requires CELO for network fees. Continue using CELO?"
      confirmLabel="Continue"
      onConfirm={() => settle(true)}
      onCancel={() => settle(false)}
    />
  )
}
