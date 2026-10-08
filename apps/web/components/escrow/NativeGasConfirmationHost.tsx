'use client'

import { useEffect } from 'react'
import { NATIVE_GAS_COPY } from '@tenda/shared'
import { ConfirmDialog } from '@/components/ui/overlay/ConfirmDialog'
import { useNativeGasConfirmation } from '@/wallet/native-gas-confirmation'

export function NativeGasConfirmationHost() {
  const open = useNativeGasConfirmation(state => state.pending !== null)
  const settle = useNativeGasConfirmation(state => state.settle)
  useEffect(() => () => settle(false), [settle])
  return <ConfirmDialog open={open} {...NATIVE_GAS_COPY}
    onConfirm={() => settle(true)} onCancel={() => settle(false)} />
}
