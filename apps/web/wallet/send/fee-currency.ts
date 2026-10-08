import { useNativeGasConfirmation } from '../native-gas-confirmation'

export async function approveNativeGasFallback(
  ensureChain: () => Promise<void>,
): Promise<void> {
  await useNativeGasConfirmation.getState().request()
  await ensureChain()
}
