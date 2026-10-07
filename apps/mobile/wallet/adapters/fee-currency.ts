import { useNativeGasConfirmation } from '../native-gas-confirmation'

export function confirmNativeGas(): Promise<void> {
  return useNativeGasConfirmation.getState().request()
}
